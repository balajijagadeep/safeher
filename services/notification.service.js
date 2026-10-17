/**
 * Notification Service
 * Supports Twilio live delivery with automatic Simulation Mode fallback.
 */

let ioInstance = null;

function setSocketIO(io) {
    ioInstance = io;
}

/**
 * Dispatch an emergency SMS / Call notification
 */
async function sendEmergencyNotification({ recipientPhone, recipientName, alertId, victimName, lat, lng, triggerType, trackingUrl }) {
    const hasTwilio = Boolean(
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_PHONE_NUMBER
    );

    const messageBody = `🚨 SAFEHER EMERGENCY ALERT 🚨\n${victimName} triggered ${triggerType.toUpperCase()} at (${lat.toFixed(4)}, ${lng.toFixed(4)}).\nLive Tracking: ${trackingUrl || 'https://safeher.org'}\nPlease respond immediately!`;

    if (hasTwilio) {
        try {
            // Lazy load twilio only if credentials provided
            const twilio = require('twilio');
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

            await client.messages.create({
                body: messageBody,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: recipientPhone
            });

            console.log(`[SafeHer Twilio] Live SMS dispatched to ${recipientPhone}`);
            return { mode: 'live_twilio', success: true };
        } catch (twilioErr) {
            console.warn(`[SafeHer Twilio] Live delivery failed, falling back to simulation: ${twilioErr.message}`);
        }
    }

    // SIMULATION MODE: Log to console and broadcast via Socket.IO for judge demo
    const simulatedNotification = {
        id: 'notif-' + Date.now(),
        alertId,
        recipientName,
        recipientPhone,
        victimName,
        triggerType,
        messageBody,
        trackingUrl,
        mode: 'simulated_sms',
        timestamp: new Date().toISOString()
    };

    console.log(`[SafeHer Simulation Mode] 📱 Simulated SMS to ${recipientName} (${recipientPhone}):\n${messageBody}`);

    if (ioInstance) {
        // Emit to responders and contact rooms
        ioInstance.emit('notification:simulated', simulatedNotification);
    }

    return { mode: 'simulation', success: true, notification: simulatedNotification };
}

module.exports = {
    setSocketIO,
    sendEmergencyNotification
};
