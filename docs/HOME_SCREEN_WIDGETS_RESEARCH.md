# Home Screen Widgets Research for Gather

**Research Date:** February 3, 2026
**Status:** Research Complete - Implementation Requires Phase 3 Native Apps

---

## Executive Summary

Home screen widgets (the kind that show live data on iOS/Android home screens) **cannot be implemented with a PWA alone**. True widgets require native code. However, there are PWA capabilities available today that can provide some quick-access functionality, and the path to native widgets is well-documented for when Phase 3 begins.

---

## Current State: What Gather Has

Gather is currently a **Next.js/React Progressive Web App (PWA)** with:
- `manifest.json` configured with basic PWA metadata
- One app shortcut defined ("Add Task")
- Proper icons for home screen installation

---

## Option 1: PWA App Shortcuts (Available Now)

### What It Is
App shortcuts allow users to long-press the PWA icon to access quick actions. They appear in a context menu, not as separate widgets.

### Platform Support
| Platform | Support |
|----------|---------|
| Android (Chrome) | Yes |
| Windows (Chrome/Edge) | Yes |
| macOS (Chrome) | Yes |
| **iOS** | **No** |

### Current Implementation
Gather already has one shortcut defined in `/public/manifest.json`:
```json
"shortcuts": [
  {
    "name": "Add Task",
    "short_name": "Add",
    "description": "Quickly add a new task",
    "url": "/?action=add",
    "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192" }]
  }
]
```

### Recommended Additional Shortcuts
```json
"shortcuts": [
  {
    "name": "Add Task",
    "short_name": "Add",
    "description": "Quickly add a new task",
    "url": "/?action=add",
    "icons": [{ "src": "/icons/shortcut-add.png", "sizes": "192x192" }]
  },
  {
    "name": "Today's Tasks",
    "short_name": "Today",
    "description": "View tasks due today",
    "url": "/?view=today",
    "icons": [{ "src": "/icons/shortcut-today.png", "sizes": "192x192" }]
  },
  {
    "name": "Quick Dump",
    "short_name": "Dump",
    "description": "Brain dump thoughts quickly",
    "url": "/?action=dump",
    "icons": [{ "src": "/icons/shortcut-dump.png", "sizes": "192x192" }]
  },
  {
    "name": "Focus Mode",
    "short_name": "Focus",
    "description": "Start focus mode",
    "url": "/?action=focus",
    "icons": [{ "src": "/icons/shortcut-focus.png", "sizes": "192x192" }]
  }
]
```

### Limitations
- **Not visible on home screen** - only accessible via long-press
- **No live data** - just launches the app at a specific URL
- **iOS does not support this feature at all**

---

## Option 2: PWA Widget Proposals (Experimental/Future)

### Status
Microsoft Edge team has been exploring PWA widgets as a web standard. There's an [active proposal on GitHub](https://github.com/AaronGustafson/pwa-widgets), but:
- Still in early proposal stage
- No browser has shipped support
- Timeline to standardization is unclear
- iOS adoption is highly uncertain given Apple's PWA stance

### Verdict
**Do not wait for this.** The standard may never materialize, and even if it does, iOS support is unlikely.

---

## Option 3: Native Widgets via React Native (Phase 3)

### Why Native Code Is Required

> "You can't use React Native directly to build the widget. iOS has a 16 MB memory limit for app extensions, and React Native would take most of it."

Widgets must be written in:
- **iOS:** Swift with WidgetKit/SwiftUI
- **Android:** Kotlin/Java with Android's widget framework

React Native can **communicate** with widgets but cannot **render** them.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    React Native App                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │           JavaScript Business Logic              │    │
│  │         (Task data, user preferences)            │    │
│  └──────────────────────┬──────────────────────────┘    │
│                         │                                │
│            ┌────────────┴────────────┐                  │
│            ▼                         ▼                  │
│   ┌─────────────────┐     ┌─────────────────┐          │
│   │  UserDefaults   │     │ SharedPreferences│          │
│   │     (iOS)       │     │    (Android)     │          │
│   │   App Groups    │     │                  │          │
│   └────────┬────────┘     └────────┬────────┘          │
└────────────┼─────────────────────────┼──────────────────┘
             │                         │
             ▼                         ▼
┌────────────────────────┐  ┌────────────────────────┐
│    iOS Widget          │  │   Android Widget       │
│  (Swift + WidgetKit)   │  │  (Kotlin + Compose)    │
│                        │  │                        │
│  - Reads UserDefaults  │  │  - Reads SharedPrefs   │
│  - Renders with SwiftUI│  │  - Renders with Views  │
│  - Taps launch app     │  │  - Taps launch app     │
└────────────────────────┘  └────────────────────────┘
```

### Prerequisites for Implementation

1. **React Native Project Setup**
   - Migrate from Next.js web app to React Native (or maintain both)
   - Set up Expo managed workflow (recommended) or bare workflow
   - Expo SDK 53+ required for widget support

2. **iOS Requirements**
   - Xcode 16+ (requires macOS 15 Sequoia)
   - Apple Developer Account ($99/year)
   - CocoaPods 1.16.2+ with Ruby 3.2.0+
   - Learn Swift/SwiftUI for widget code

3. **Android Requirements**
   - Android Studio
   - Google Play Developer Account ($25 one-time)
   - Learn Kotlin for widget code

4. **Expo Configuration**
   - Install `@bacons/apple-targets` for iOS widgets
   - Configure `expo-target.config.js` with App Groups
   - Set up shared storage for data communication

### Recommended Widget Types for Gather

| Widget | Size | Content | Priority |
|--------|------|---------|----------|
| **Quick Task Count** | Small | "3 tasks today" with tap to open | High |
| **Today's Top Task** | Medium | Shows highest priority task with one-tap complete | High |
| **Task List** | Large | Shows 3-5 tasks with completion toggles | Medium |
| **Focus Timer** | Small | Shows active focus session time | Medium |
| **Weekly Progress** | Medium | Tasks completed this week visualization | Low |

### Scope Estimate for Phase 3 Widget Implementation

| Task | Effort | Notes |
|------|--------|-------|
| React Native migration | 4-6 weeks | If not already done |
| iOS widget (small) | 1 week | Swift/SwiftUI learning curve |
| iOS widget (medium/large) | 1-2 weeks | More complex layouts |
| Android widget (small) | 1 week | Kotlin/Compose |
| Android widget (medium/large) | 1-2 weeks | More complex layouts |
| Shared storage bridge | 3-5 days | Data sync between app and widgets |
| Testing & polish | 1 week | Both platforms |
| **Total (all widgets)** | **8-12 weeks** | After RN migration |

### Code Examples

#### iOS Widget Data Sharing (Swift)
```swift
// In React Native bridge (Swift)
@objc(SharedStorage)
class SharedStorage: NSObject {
  @objc func set(_ data: String, forKey key: String) {
    let userDefaults = UserDefaults(suiteName: "group.gather.app")
    userDefaults?.set(data, forKey: key)
    WidgetCenter.shared.reloadAllTimelines()
  }
}

// In Widget (Swift/SwiftUI)
struct GatherWidgetEntry: TimelineEntry {
    let date: Date
    let tasks: [Task]
}

struct GatherWidgetView: View {
    var entry: GatherWidgetEntry

    var body: some View {
        VStack(alignment: .leading) {
            Text("\(entry.tasks.count) tasks today")
                .font(.headline)
            if let topTask = entry.tasks.first {
                Text(topTask.title)
                    .font(.subheadline)
            }
        }
    }
}
```

#### Android Widget Data Sharing (Kotlin)
```kotlin
// SharedStorageModule.kt
class SharedStorageModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    @ReactMethod
    fun set(key: String, data: String) {
        val prefs = reactApplicationContext
            .getSharedPreferences("gather_widget", Context.MODE_PRIVATE)
        prefs.edit().putString(key, data).apply()

        // Trigger widget update
        val intent = Intent(reactApplicationContext, GatherWidget::class.java)
        intent.action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
        reactApplicationContext.sendBroadcast(intent)
    }
}
```

---

## Option 4: Alternative Quick-Access Features (PWA)

While true widgets aren't possible, these PWA features can improve quick access:

### 1. Push Notifications (Available Now)
- iOS 16.4+ supports PWA push notifications
- Can show task reminders, daily summaries
- User must add PWA to home screen first

### 2. Media Session API (Limited Use)
- Can show info on lock screen during "media playback"
- Could potentially show focus timer info
- Hacky and not recommended

### 3. Badging API (Limited)
- Can show notification badge count on app icon
- Supported on some platforms
- Shows number, not custom content

---

## Recommendation

### Immediate (PWA Phase)
1. **Add more app shortcuts** to manifest.json for Android/Desktop users
2. **Implement push notifications** for proactive nudges
3. **Document widget plans** for Phase 3 marketing

### Phase 3 (Native Apps)
1. Start with **small "task count" widget** - simplest to implement
2. Add **medium "today's task" widget** - most useful for ADHD users
3. Consider **iOS Live Activities** for focus timer sessions
4. Android **lock screen widgets** are more flexible than iOS

### Do Not Pursue
- PWA widget standards (too speculative)
- Third-party widget wrapper apps (poor UX, security concerns)
- Siri Shortcuts integration (requires native)

---

## Key Resources

### PWA Capabilities
- [PWA Enhancements - web.dev](https://web.dev/learn/pwa/enhancements)
- [PWA Shortcuts - MDN](https://developer.mozilla.org/en-US/docs/Web/Manifest/shortcuts)
- [PWAs on iOS 2025 - Medium](https://ravi6997.medium.com/pwas-on-ios-in-2025-why-your-web-app-might-beat-native-0b1c35acf845)

### React Native Widgets
- [React Native Widget Guide - DEV Community](https://dev.to/rushitjivani/react-native-ultimate-guide-to-create-a-home-screen-widget-for-ios-and-android-1h9g)
- [Expo Widgets Documentation](https://docs.expo.dev/versions/v55.0.0/sdk/widgets/)
- [expo-apple-targets Plugin](https://github.com/EvanBacon/expo-apple-targets)
- [react-native-widget-extension](https://github.com/bndkt/react-native-widget-extension)
- [Building Dynamic Widgets 2025](https://medium.com/@faheem.tfora/building-dynamic-home-screen-widgets-in-react-native-android-ios-complete-2025-dc060feacddc)

### PWA Widget Proposals (Experimental)
- [PWA Widgets Proposal - GitHub](https://github.com/AaronGustafson/pwa-widgets)

---

## Conclusion

**Home screen widgets require native code and cannot be implemented in a PWA.** The good news is:

1. Gather already has PWA shortcuts configured (Android/Desktop)
2. The path to native widgets via React Native/Expo is well-documented
3. Phase 3 native app plans already exist in the product spec
4. Widget implementation scope is reasonable (8-12 weeks after RN migration)

For ADHD users, widgets showing "3 tasks today" or their top priority task would be genuinely valuable - a constant visual reminder without requiring app launch. This should be a high priority feature when Phase 3 begins.
