#include <DustWave/ReviewedReportClient.h>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QJsonDocument>
#include <QJsonObject>
#include <cmath>
#include <memory>

namespace DustWave {
ReviewedReportClient::ReviewedReportClient(QObject *parent)
    : ReviewedReportClient(new QNetworkAccessManager, parent) { m_network->setParent(this); }
ReviewedReportClient::ReviewedReportClient(QNetworkAccessManager *network, QObject *parent)
    : QObject(parent), m_network(network) { Q_ASSERT(network); }

void ReviewedReportClient::send(const QByteArray &bytes, const QString &reportID, const Options &options) {
    if (m_busy) return;
    const auto &url = options.endpoint;
    if (bytes.isEmpty() || bytes.size() > options.maximumReportBytes || reportID.isEmpty() ||
        options.maximumResponseBytes <= 0 || options.maximumResponseBytes > 1048576 || options.timeoutMilliseconds <= 0 ||
        !url.isValid() || url.scheme() != QStringLiteral("https") || url.host().isEmpty() ||
        !url.userInfo().isEmpty() || url.hasQuery() || url.hasFragment()) {
        emit failed(Failure::InvalidRequest); return;
    }
    QNetworkRequest request(url);
    request.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
    request.setRawHeader("User-Agent", options.userAgent);
    request.setTransferTimeout(options.timeoutMilliseconds);
    request.setAttribute(QNetworkRequest::RedirectPolicyAttribute, QNetworkRequest::ManualRedirectPolicy);
    request.setAttribute(QNetworkRequest::CookieLoadControlAttribute, QNetworkRequest::Manual);
    request.setAttribute(QNetworkRequest::CookieSaveControlAttribute, QNetworkRequest::Manual);
    request.setAttribute(QNetworkRequest::AuthenticationReuseAttribute, QNetworkRequest::Manual);
    request.setAttribute(QNetworkRequest::CacheLoadControlAttribute, QNetworkRequest::AlwaysNetwork);
    request.setAttribute(QNetworkRequest::CacheSaveControlAttribute, false);
    m_busy = true;
    QNetworkReply *reply = m_network->post(request, bytes);
    // Bound the reply's buffering as well as our accumulated response.
    reply->setReadBufferSize(options.maximumResponseBytes + 1);
    struct Response { QByteArray bytes; bool oversized = false; };
    const auto response = std::make_shared<Response>();
    auto read = [reply, response, limit = options.maximumResponseBytes] {
        if (response->oversized) return;
        response->bytes.append(reply->read(limit + 1 - response->bytes.size()));
        if (response->bytes.size() > limit) { response->oversized = true; reply->abort(); }
    };
    connect(reply, &QIODevice::readyRead, this, read);
    connect(reply, &QNetworkReply::finished, this, [this, reply, response, read, reportID, url] {
        read();
        m_busy = false;
        const int status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const auto error = reply->error();
        const auto actualURL = reply->url();
        reply->deleteLater();
        if (response->oversized) { emit failed(Failure::Unconfirmed); return; }
        if (status && (status != 200 || actualURL != url)) { emit failed(Failure::Rejected); return; }
        if (error != QNetworkReply::NoError || status != 200) { emit failed(Failure::Unavailable); return; }
        const auto document = QJsonDocument::fromJson(response->bytes);
        const auto receipt = document.object();
        const auto number = receipt.value(QStringLiteral("issueNumber"));
        const auto action = receipt.value(QStringLiteral("action")).toString();
        const double issue = number.toDouble();
        if (!document.isObject() || !receipt.value(QStringLiteral("ok")).isBool() ||
            !receipt.value(QStringLiteral("ok")).toBool() || receipt.value(QStringLiteral("reportId")).toString() != reportID ||
            !number.isDouble() || !std::isfinite(issue) || issue <= 0 || issue > 9007199254740991.0 || std::floor(issue) != issue ||
            (action != QStringLiteral("created") && action != QStringLiteral("updated") && action != QStringLiteral("duplicate"))) {
            emit failed(Failure::Unconfirmed); return;
        }
        emit acknowledged(reportID, static_cast<qint64>(issue), action);
    });
}
}
