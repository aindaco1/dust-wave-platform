// Public AppKit/CoreGraphics enumeration in the same top-left coordinates as WindowServer.
#import <AppKit/AppKit.h>
int main() {
    @autoreleasepool {
        [NSApplication sharedApplication];
        [NSApp setActivationPolicy:NSApplicationActivationPolicyProhibited];
        NSMutableArray *screens = [NSMutableArray array];
        for (NSScreen *screen in NSScreen.screens) {
            CGDirectDisplayID displayID = [screen.deviceDescription[@"NSScreenNumber"] unsignedIntValue];
            CGRect frame = CGDisplayBounds(displayID);
            CFUUIDRef uuid = CGDisplayCreateUUIDFromDisplayID(displayID);
            NSString *identifier = uuid ? CFBridgingRelease(CFUUIDCreateString(nil, uuid)) : @"";
            if (uuid) CFRelease(uuid);
            [screens addObject:@{@"name": screen.localizedName, @"id": identifier, @"displayID": @(displayID),
                @"x": @(frame.origin.x), @"y": @(frame.origin.y), @"width": @(frame.size.width),
                @"height": @(frame.size.height), @"scale": @(screen.backingScaleFactor)}];
        }
        NSData *json = [NSJSONSerialization dataWithJSONObject:screens options:0 error:nil];
        puts([[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding].UTF8String);
    }
}
