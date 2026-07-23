const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");
const { json, method } = require("./_lib/http");
const auth = require("./_lib/adultAuth");

const rpID = process.env.WEBAUTHN_RP_ID || "chongseb.netlify.app";
const origin = process.env.WEBAUTHN_ORIGIN || "https://chongseb.netlify.app";

exports.handler = async event => {
  const invalid = method(event, "POST");
  if (invalid) return invalid;
  if (!process.env.JWT_SECRET && !process.env.ADULT_SESSION_SECRET) return json(503, { error: "Restricted access is not configured" });

  try {
    const body = JSON.parse(event.body || "{}");
    const userId = auth.safeId(body.userId);
    if (!userId) return json(400, { error: "Invalid user" });
    const current = (await auth.record(userId)) || {};

    if (body.action === "register-options") {
      if (current.credentialId) return json(409, { error: "Credential already registered; authenticate instead" });
      const options = await generateRegistrationOptions({
        rpName: "CHONGSEB",
        rpID,
        userID: Buffer.from(userId),
        userName: `chongseb-${userId.slice(0, 8)}`,
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "required",
        },
        excludeCredentials: current.credentialId
          ? [{ id: current.credentialId, transports: current.transports || [] }]
          : [],
      });
      await auth.save(userId, { webauthnChallenge: options.challenge, challengePurpose: "register" });
      return json(200, options);
    }

    if (body.action === "register-verify") {
      if (current.credentialId) return json(409, { error: "Credential already registered" });
      if (!current.webauthnChallenge || current.challengePurpose !== "register") return json(400, { error: "Expired challenge" });
      const verification = await verifyRegistrationResponse({
        response: body.credential,
        expectedChallenge: current.webauthnChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
      if (!verification.verified || !verification.registrationInfo) return json(401, { error: "Biometric verification failed" });
      const credential = verification.registrationInfo.credential;
      await auth.save(userId, {
        credentialId: credential.id,
        credentialPublicKey: Buffer.from(credential.publicKey).toString("base64"),
        credentialCounter: credential.counter,
        transports: credential.transports || body.credential?.response?.transports || [],
        biometricEnrolled: true,
        webauthnChallenge: "",
        challengePurpose: "",
      });
      return json(200, { verified: true, pending: current.status !== "approved" });
    }

    if (body.action === "auth-options") {
      if (!current.credentialId) return json(404, { error: "No registered credential" });
      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: "required",
        allowCredentials: [{ id: current.credentialId, transports: current.transports || [] }],
      });
      await auth.save(userId, { webauthnChallenge: options.challenge, challengePurpose: "authenticate" });
      return json(200, options);
    }

    if (body.action === "auth-verify") {
      if (!current.credentialId || !current.webauthnChallenge || current.challengePurpose !== "authenticate") {
        return json(400, { error: "Expired challenge" });
      }
      const verification = await verifyAuthenticationResponse({
        response: body.credential,
        expectedChallenge: current.webauthnChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
        credential: {
          id: current.credentialId,
          publicKey: Buffer.from(current.credentialPublicKey, "base64"),
          counter: Number(current.credentialCounter || 0),
          transports: current.transports || [],
        },
      });
      if (!verification.verified) return json(401, { error: "Biometric verification failed" });
      await auth.save(userId, {
        credentialCounter: verification.authenticationInfo.newCounter,
        webauthnChallenge: "",
        challengePurpose: "",
        lastBiometricAt: new Date().toISOString(),
      });
      if (current.status !== "approved") return json(202, { verified: true, pending: true });
      return {
        ...json(200, { verified: true, approved: true }),
        multiValueHeaders: { "Set-Cookie": [auth.sessionCookie(userId)] },
      };
    }

    return json(400, { error: "Unknown action" });
  } catch (error) {
    console.error("adult-webauthn", error.message);
    return json(400, { error: "Could not complete secure authentication" });
  }
};
