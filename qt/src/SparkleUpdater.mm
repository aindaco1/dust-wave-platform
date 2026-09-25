#include <DustWave/SparkleUpdater.h>
#import <Sparkle/Sparkle.h>

@interface DustWaveUpdaterDelegate : NSObject <SPUUpdaterDelegate>
@property(nonatomic, assign) DustWave::SparkleUpdater *bridge;
@end

@implementation DustWaveUpdaterDelegate
- (void)updater:(SPUUpdater *)updater didFindValidUpdate:(SUAppcastItem *)item {
    Q_UNUSED(updater);
    if (self.bridge) emit self.bridge->available(QString::fromUtf8(item.displayVersionString.UTF8String));
}
- (void)updaterDidNotFindUpdate:(SPUUpdater *)updater {
    Q_UNUSED(updater);
    if (self.bridge) emit self.bridge->current();
}
- (void)updater:(SPUUpdater *)updater didFinishUpdateCycleForUpdateCheck:(SPUUpdateCheck)check error:(NSError *)error {
    Q_UNUSED(updater); Q_UNUSED(check);
    if (!self.bridge) return;
    if (error && error.code != SUNoUpdateError) emit self.bridge->failed();
    emit self.bridge->finished();
}
@end

namespace DustWave {
struct SparkleUpdater::Impl {
    SPUStandardUpdaterController *controller;
    DustWaveUpdaterDelegate *delegate;
    bool started = false;
};
SparkleUpdater::SparkleUpdater(QObject *parent) : UpdateDriver(parent), m_impl(std::make_unique<Impl>()) {
    m_impl->delegate = [DustWaveUpdaterDelegate new];
    m_impl->delegate.bridge = this;
    m_impl->controller = [[SPUStandardUpdaterController alloc] initWithStartingUpdater:NO
        updaterDelegate:m_impl->delegate userDriverDelegate:nil];
}
SparkleUpdater::~SparkleUpdater() { m_impl->delegate.bridge = nullptr; }
bool SparkleUpdater::canCheck() const { return !m_impl->started || m_impl->controller.updater.canCheckForUpdates; }
void SparkleUpdater::check(bool informationOnly) {
    NSError *error = nil;
    if (!m_impl->started) {
        if (![m_impl->controller.updater startUpdater:&error]) { emit failed(); emit finished(); return; }
        m_impl->started = true;
    }
    if (!canCheck()) return;
    if (informationOnly) [m_impl->controller.updater checkForUpdateInformation];
    else [m_impl->controller checkForUpdates:nil];
}
}
