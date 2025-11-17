# ⚙️ Settings & Customization

Personalize your Zentrio experience with comprehensive settings and customization options. This guide covers all available settings and how to configure them.

## 🎯 Overview of Settings

Zentrio offers per-profile settings that allow you to customize:
- **Theme Selection**: Choose from multiple built-in themes
- **Addon Management**: Reorder and organize your Stremio addons
- **UI Customization**: Show/hide interface elements
- **Privacy Settings**: Configure NSFW filters and content preferences
- **Profile Settings**: Name, avatar, and personal preferences

## 🎨 Theme Selection

### Available Themes

| Theme | Description | Best For |
|-------|-------------|----------|
| **Zentrio** | Default dark theme with blue accents | General use |
| **Midnight** | Dark theme with purple accents | Night viewing |
| **Stremio** | Classic Stremio-inspired theme | Familiar experience |
| **Light** | Clean light theme | Daytime use |

### Switching Themes

1. Go to **Settings** from the main menu
2. Select **Appearance** or **Theme**
3. Choose your preferred theme from the dropdown
4. Changes apply instantly

### Theme Customization

::: tip 🎨 Custom Themes
Want to create your own theme? Check our [development guide](../development/themes.md) for theme creation instructions.
:::

## 🔌 Addon Management

### Reordering Addons

Organize your Stremio addons based on usage frequency:

1. Navigate to **Settings** → **Addons**
2. Drag and drop addons to reorder
3. Your preference is saved per profile
4. Changes reflect immediately in Stremio interface

### Addon Categories

- **Video**: Streaming sources and content providers
- **Subtitles**: Subtitle services
- **Catalogs**: Content discovery and metadata
- **Meta**: Metadata and information providers

### Best Practices

- Place most-used addons at the top
- Group similar addons together
- Test addon order for optimal streaming performance

## 🖥️ UI Customization

### Interface Elements

Show or hide interface elements based on your preferences:

| Element | Description | When to Hide |
|---------|-------------|--------------|
| **Calendar** | Content release calendar | If not used |
| **Discover** | Content discovery section | Prefer browsing |
| **Board** | Personal dashboard | Use profiles instead |
| **Addons** | Addon management button | Manage infrequently |

### Customization Steps

1. Go to **Settings** → **Interface**
2. Toggle elements on/off using switches
3. Preview changes in real-time
4. Settings save automatically

### Layout Options

- **Compact Mode**: Reduce spacing between elements
- **Wide Mode**: Utilize full screen width
- **Grid View**: Display content in grid format
- **List View**: Display content in list format

## 🔒 Privacy & Content Settings

### NSFW Filter

Control adult content visibility:

```bash
# Settings Location: Settings → Privacy → NSFW Filter
```

**Options**:
- **Strict**: Hide all NSFW content
- **Moderate**: Blur NSFW content
- **Disabled**: Show all content

### Content Preferences

Configure content recommendations:

- **Language Preference**: Set preferred content languages
- **Quality Preference**: Default streaming quality
- **Subtitle Settings**: Default subtitle language and appearance

## 👤 Profile Settings

### Basic Information

- **Profile Name**: Display name for the profile
- **Avatar**: Upload custom profile image
- **Description**: Optional profile description

### Avatar Upload

1. Go to **Profile Settings**
2. Click on avatar area
3. Select image file (PNG, JPG, JPEG)
4. Crop and adjust as needed
5. Save changes

**Requirements**:
- Maximum file size: 5MB
- Supported formats: PNG, JPG, JPEG
- Recommended size: 512x512px

### Profile Switching

Quickly switch between profiles:

- **From Menu**: Click profile icon → Select profile
- **Keyboard Shortcut**: `Ctrl+P` (or `Cmd+P` on Mac)
- **Auto-switch**: Set default profile on login

## 🔧 Advanced Settings

### Performance Settings

Optimize Zentrio performance:

- **Cache Duration**: Set content cache timeout
- **Preload Settings**: Configure content preloading
- **Network Timeout**: Adjust request timeout values

### Developer Options

::: warning ⚠️ Advanced Users Only
These settings are intended for advanced users and developers.
:::

- **Debug Mode**: Enable detailed logging
- **API Access**: Configure API endpoints
- **Experimental Features**: Test new features

## 💾 Backup & Sync

### Settings Backup

Export your profile settings:

1. Go to **Settings** → **Advanced**
2. Click **Export Settings**
3. Save the JSON file to your device

### Settings Restore

Import previously saved settings:

1. Go to **Settings** → **Advanced**
2. Click **Import Settings**
3. Select your backup file
4. Confirm import

### Sync Across Devices

Settings automatically sync when:
- Using the same Zentrio instance
- Logged into the same profile
- Network connection is available

## 🔄 Settings Reset

### Reset Individual Settings

1. Go to **Settings** → category
2. Find the setting to reset
3. Click **Reset to Default**
4. Confirm the action

### Full Profile Reset

::: danger ⚠️ Data Loss Warning
This will reset ALL settings for the current profile. This action cannot be undone.
:::

1. Go to **Settings** → **Advanced**
2. Scroll to **Danger Zone**
3. Click **Reset Profile Settings**
4. Enter profile name to confirm
5. Confirm reset

## 📱 Mobile Settings

### Mobile-Specific Options

- **Touch Gestures**: Configure swipe actions
- **Offline Mode**: Enable offline functionality
- **Push Notifications**: Configure alerts and reminders
- **Battery Optimization**: Balance performance and battery life

### PWA Settings

For Progressive Web App users:

- **Home Screen**: Add to home screen settings
- **Offline Content**: Configure offline availability
- **Update Behavior**: Set app update preferences

## 🎯 Pro Tips

### Setting Up Multiple Profiles

1. **Family Profiles**: Create profiles for each family member
2. **Content Types**: Separate profiles for movies vs series
3. **Testing**: Use a test profile for experimenting with settings
4. **Guest Profile**: Create a temporary profile for visitors

### Optimizing Performance

1. **Regular Cleanup**: Remove unused addons and settings
2. **Cache Management**: Clear cache periodically
3. **Profile Limits**: Don't create excessive profiles
4. **Network**: Ensure stable internet connection

### Privacy Best Practices

1. **Unique Credentials**: Use unique Stremio credentials per profile
2. **Regular Updates**: Keep profiles and settings updated
3. **Secure Storage**: Use strong authentication for self-hosted instances
4. **Data Minimization**: Only store necessary information

## 🆘 Troubleshooting Settings Issues

### Settings Not Saving

1. Check browser localStorage permissions
2. Verify database file permissions (self-hosted)
3. Clear browser cache and try again
4. Check for JavaScript errors in console

### Theme Not Applying

1. Refresh the page after changing theme
2. Clear browser cache
3. Check if custom CSS is interfering
4. Try a different browser

### Avatar Upload Fails

1. Check file size and format
2. Verify internet connection
3. Try a different image
4. Check server logs (self-hosted)

---

Need more help? [Check our troubleshooting guide](../help/troubleshooting.md) or [ask the community](https://github.com/MichielEijpe/Zentrio/discussions).