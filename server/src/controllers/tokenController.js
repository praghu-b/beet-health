const { AccessToken } = require('livekit-server-sdk');

const getLivekitToken = async (req, res) => {
  try {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return res.status(500).json({
        success: false,
        message: 'LiveKit server credentials are not properly configured on backend.',
      });
    }

    const room = req.query.room || 'beet-meal-logger';
    const participantName =
      req.query.username || `user-${Math.floor(1000 + Math.random() * 9000)}`;

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      name: participantName,
      ttl: '4h',
    });

    at.addGrant({
      roomJoin: true,
      room: room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return res.status(200).json({
      success: true,
      token,
      url: livekitUrl,
      room,
      identity: participantName,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to generate LiveKit access token',
      error: error.message,
    });
  }
};

module.exports = {
  getLivekitToken,
};
