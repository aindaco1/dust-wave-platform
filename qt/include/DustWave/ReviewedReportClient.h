#pragma once
#include <QObject>
#include <QByteArray>
#include <QString>
#include <QUrl>

class QNetworkAccessManager;
namespace DustWave {

// Payload creation, review, persistence and retries belong to the consumer.
class ReviewedReportClient final : public QObject {
    Q_OBJECT
public:
    struct Options {
        QUrl endpoint;
        QByteArray userAgent;
        int timeoutMilliseconds = 8000;
        qint64 maximumReportBytes = 32768;
        qint64 maximumResponseBytes = 4096;
    };
    enum class Failure { InvalidRequest, Unavailable, Rejected, Unconfirmed };
    Q_ENUM(Failure)
    explicit ReviewedReportClient(QObject *parent = nullptr);
    ReviewedReportClient(QNetworkAccessManager *network, QObject *parent);
    bool busy() const { return m_busy; }
    void send(const QByteArray &reviewedBytes, const QString &reportID, const Options &options);
signals:
    void acknowledged(const QString &reportID, qint64 issueNumber, const QString &action);
    void failed(DustWave::ReviewedReportClient::Failure reason);
private:
    QNetworkAccessManager *m_network;
    bool m_busy = false;
};
}
