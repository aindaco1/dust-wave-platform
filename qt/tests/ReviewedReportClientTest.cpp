#include <QtTest>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QJsonDocument>
#include <QJsonObject>
#include <QTimer>
#include <cstring>
#include <DustWave/ReviewedReportClient.h>

class Reply final : public QNetworkReply {
public:
    Reply(const QNetworkRequest &request, QByteArray body, int status, QObject *parent)
        : QNetworkReply(parent), m_body(std::move(body)) {
        setRequest(request); setUrl(request.url());
        setAttribute(QNetworkRequest::HttpStatusCodeAttribute, status);
        open(QIODevice::ReadOnly);
        QTimer::singleShot(0, this, [this] {
            emit readyRead();
            if (!isFinished()) { setFinished(true); emit finished(); }
        });
    }
    void abort() override {
        if (isFinished()) return;
        setError(QNetworkReply::OperationCanceledError, QStringLiteral("cancelled"));
        setFinished(true); emit finished();
    }
    qint64 bytesAvailable() const override { return m_body.size() - m_offset + QNetworkReply::bytesAvailable(); }
protected:
    qint64 readData(char *data, qint64 maximum) override {
        const qint64 count = qMin(maximum, m_body.size() - m_offset);
        if (count <= 0) return -1;
        std::memcpy(data, m_body.constData() + m_offset, count); m_offset += count; return count;
    }
private:
    QByteArray m_body;
    qint64 m_offset = 0;
};
class Network final : public QNetworkAccessManager {
public:
    QByteArray response;
    QList<QByteArray> sent;
    QList<QNetworkRequest> requests;
    int status = 200;
protected:
    QNetworkReply *createRequest(Operation, const QNetworkRequest &request, QIODevice *data) override {
        sent.append(data->readAll()); requests.append(request);
        return new Reply(request, response, status, this);
    }
};
class ReviewedReportClientTest : public QObject {
    Q_OBJECT
private slots:
    void requiresMatchingReceipt_data() {
        QTest::addColumn<QJsonObject>("receipt"); QTest::addColumn<bool>("accepted");
        const QJsonObject valid{{"ok", true}, {"reportId", "reviewed-id"}, {"issueNumber", 7}, {"action", "created"}};
        QTest::newRow("valid") << valid << true;
        for (const auto &action : {"updated", "duplicate"}) {
            auto value = valid; value["action"] = action; QTest::newRow(action) << value << true;
        }
        for (const auto &key : {"ok", "reportId", "issueNumber", "action"}) {
            auto value = valid; value.remove(key); QTest::newRow(key) << value << false;
        }
        auto wrong = valid; wrong["reportId"] = "different"; QTest::newRow("wrong id") << wrong << false;
        auto number = valid; number["issueNumber"] = true; QTest::newRow("boolean issue") << number << false;
        number["issueNumber"] = 1.5; QTest::newRow("fractional issue") << number << false;
        number["issueNumber"] = 0; QTest::newRow("zero issue") << number << false;
        number["issueNumber"] = 9007199254740992.0; QTest::newRow("overflow issue") << number << false;
    }
    void requiresMatchingReceipt() {
        QFETCH(QJsonObject, receipt); QFETCH(bool, accepted);
        Network network; network.response = QJsonDocument(receipt).toJson();
        DustWave::ReviewedReportClient client(&network, nullptr);
        QSignalSpy success(&client, &DustWave::ReviewedReportClient::acknowledged);
        QSignalSpy failure(&client, &DustWave::ReviewedReportClient::failed);
        client.send("reviewed bytes", "reviewed-id", {QUrl("https://example.invalid/reports"), "Test"});
        QTRY_VERIFY(!client.busy());
        QCOMPARE(success.count(), accepted ? 1 : 0); QCOMPARE(failure.count(), accepted ? 0 : 1);
        QCOMPARE(network.sent, QList<QByteArray>{"reviewed bytes"});
        QCOMPARE(network.requests.first().attribute(QNetworkRequest::RedirectPolicyAttribute).toInt(), int(QNetworkRequest::ManualRedirectPolicy));
        QCOMPARE(network.requests.first().attribute(QNetworkRequest::CookieLoadControlAttribute).toInt(), int(QNetworkRequest::Manual));
    }
    void rejectsOversizedMalformedAndNonReceiptSuccess() {
        for (const auto &body : {QByteArray(4097, ' '), QByteArray("not json"), QByteArray("{}")}) {
            Network network; network.response = body;
            DustWave::ReviewedReportClient client(&network, nullptr);
            QSignalSpy failure(&client, &DustWave::ReviewedReportClient::failed);
            client.send("{}", "id", {QUrl("https://example.invalid/reports"), "Test"});
            QTRY_COMPARE(failure.count(), 1); QVERIFY(!client.busy());
        }
    }
    void retryKeepsCallerBytesAndOverlappingSendIsIgnored() {
        Network network; network.status = 503;
        DustWave::ReviewedReportClient client(&network, nullptr);
        QSignalSpy failure(&client, &DustWave::ReviewedReportClient::failed);
        const DustWave::ReviewedReportClient::Options options{QUrl("https://example.invalid/reports"), "Test"};
        client.send("frozen", "id", options); client.send("different", "other", options);
        QTRY_COMPARE(failure.count(), 1);
        client.send("frozen", "id", options); QTRY_COMPARE(failure.count(), 2);
        QCOMPARE(network.sent, QList<QByteArray>({"frozen", "frozen"}));
    }
    void invalidDestinationsNeverSend() {
        Network network; DustWave::ReviewedReportClient client(&network, nullptr);
        QSignalSpy failure(&client, &DustWave::ReviewedReportClient::failed);
        for (const auto &url : {"http://example.invalid", "https://user@example.invalid", "https://example.invalid?q=1", "https://example.invalid/#fragment"})
            client.send("{}", "id", {QUrl(url), "Test"});
        QCOMPARE(failure.count(), 4); QVERIFY(network.sent.isEmpty());
    }
};
QTEST_GUILESS_MAIN(ReviewedReportClientTest)
#include "ReviewedReportClientTest.moc"
