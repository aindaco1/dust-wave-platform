#pragma once
#include <QObject>
#include <QString>
#include <memory>

namespace DustWave {
// Small Qt/Objective-C++ bridge. Sparkle owns feed verification, all install UI,
// authorization, replacement and relaunch. Caller owns launch policy and consent.
class UpdateDriver : public QObject {
    Q_OBJECT
public:
    using QObject::QObject;
    virtual bool canCheck() const = 0;
    virtual void check(bool informationOnly = false) = 0;
signals:
    void available(const QString &version);
    void current();
    void failed();
    void finished();
};
class SparkleUpdater final : public UpdateDriver {
    Q_OBJECT
public:
    explicit SparkleUpdater(QObject *parent = nullptr);
    ~SparkleUpdater() override;
    bool canCheck() const override;
    void check(bool informationOnly = false) override;
private:
    struct Impl;
    std::unique_ptr<Impl> m_impl;
};
}
