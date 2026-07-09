# CCTV Connection Guide

LaFlo supports several camera connection patterns. The setup screens are intentionally separated so staff video use is not confused with security CCTV.

## USB / Local Camera

Use this for browser-connected webcams on reception laptops or staff devices.

Typical use cases:
- Support video calls
- Reception video assistance
- Staff collaboration

USB cameras are accessed through `navigator.mediaDevices.getUserMedia` in the browser. They are not saved as CCTV cameras and are not treated as NVR/security feeds.

## Discover IP Cameras

The Security Center CCTV screen supports a subnet input such as:

```text
192.168.1.0/24
```

The backend endpoint is:

```http
POST /api/cctv/discover
```

Current status: discovery returns `Discovery service is not configured` until an ONVIF discovery worker or camera gateway is deployed on the hotel network.

## Manual Camera Setup

Use manual setup when the camera stream details are known.

Supported setup fields:
- Provider
- Protocol or stream type
- Host / URL
- Port
- Channel
- Stream path
- Username
- Password
- Location
- Room / area

Supported stream types:
- HLS
- MJPEG
- Snapshot
- RTSP
- ONVIF

Secrets are encrypted on the backend and never returned to the frontend.

## NVR Setup

Use NVR setup for recorders such as:
- Hikvision
- Dahua
- Axis
- Generic ONVIF

Required fields:
- Provider
- Host
- Port
- Username
- Password
- Channel count

The test endpoint is:

```http
POST /api/cctv/nvr/test
```

Current test behavior validates that the configuration is present. Full protocol handshakes require a production connector or media gateway on the hotel network.

## HLS, MJPEG, And Snapshot

HLS, MJPEG, and snapshot URLs can often be viewed by browsers through a secure proxy. LaFlo stores the connection configuration server-side and should expose only a short-lived playback token or proxied playback URL in production.

## Why RTSP Needs A Media Gateway

Browsers do not natively play RTSP. RTSP feeds also frequently contain credentials in the URL, which must not be exposed to frontend code.

Production RTSP support should use a media gateway that:
- Connects to the RTSP source server-side
- Transcodes or remuxes to HLS/WebRTC/MJPEG
- Issues short-lived playback sessions
- Keeps camera passwords, API keys, and RTSP URLs off the client

## Future ONVIF / RTSP Gateway Plan

Recommended next steps:
- Deploy an on-prem or VPC camera gateway per hotel network
- Add ONVIF discovery and device capability checks
- Add RTSP-to-HLS/WebRTC playback sessions
- Add camera health polling
- Normalize camera status events into the Event Bus
- Emit Security Center alerts for offline or degraded cameras
