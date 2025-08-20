# Call Functionality Troubleshooting Guide

If you're seeing "Coming Soon" messages when trying to make calls, follow these troubleshooting steps:

## Quick Fixes

### 1. Clear Browser Cache
The most common cause is cached JavaScript code:
- **Chrome/Edge**: Ctrl+Shift+Delete → Clear cached images and files
- **Firefox**: Ctrl+Shift+Delete → Cached Web Content
- **Safari**: Cmd+Alt+E

### 2. Hard Refresh
Force reload the page to bypass cache:
- **Windows**: Ctrl+F5 or Ctrl+Shift+R
- **Mac**: Cmd+Shift+R
- **Alternative**: Open in incognito/private browsing mode

### 3. Check Browser Console
Open developer tools (F12) and look for errors:
1. Go to Console tab
2. Try clicking a call button
3. Look for red error messages
4. Share any errors with support

## System Requirements

### Browser Support
- Chrome/Chromium 60+
- Firefox 55+
- Safari 11+
- Edge 79+

### Required Permissions
- Camera access (for video calls)
- Microphone access (for all calls)
- Notifications (for incoming calls)

## Common Issues

### "Call functionality not available"
- The CallProvider is not properly initialized
- Try refreshing the page
- Check if you're logged in

### "Media access denied"
- Browser blocked camera/microphone
- Click the camera icon in address bar
- Select "Allow" for permissions

### "No camera or microphone found"
- Check hardware connections
- Ensure devices aren't used by other apps
- Try different browser

### Silent failures
- Check browser console for errors
- Verify network connectivity
- Ensure Supabase is properly configured

## Debug Information

When reporting issues, please include:
1. Browser version and type
2. Any console error messages
3. Steps to reproduce
4. Whether hard refresh was attempted

## Contact Support

If issues persist after following this guide:
1. Include debug information above
2. Screenshots of any error messages
3. Browser console logs (if any)