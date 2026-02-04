// Test that data persists across API restarts
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

console.log('[TEST] Starting second API instance to verify persistence...');

const apiProcess = spawn('node', ['packages/api/dist/index.js'], {
  cwd: 'c:\\Users\\walea\\playwright-agents\\Hotel Management System v1 scope\\CLAUDE',
  stdio: ['ignore', 'pipe', 'pipe']
});

// Wait for API to start
setTimeout(() => {
  // Just check if our booking is still there
  const postData = JSON.stringify({
    email: 'admin@demo.hotel',
    password: 'Demo123!'
  });

  const req = http.request({
    hostname: 'localhost',
    port: 4010,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const json = JSON.parse(data);
      const token = json.data.accessToken;
      
      // Get bookings list
      const getReq = http.request({
        hostname: 'localhost',
        port: 4010,
        path: '/api/bookings',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, (res) => {
        let bookingData = '';
        res.on('data', chunk => bookingData += chunk);
        res.on('end', () => {
          const bookings = JSON.parse(bookingData).data;
          const ourBooking = bookings.find(b => b.bookingRef === 'BK-2026-051');
          
          if (ourBooking) {
            console.log('[SUCCESS] Our booking BK-2026-051 persisted across restart!');
            console.log('[INFO] Guest:', ourBooking.guest?.name);
            console.log('[INFO] Dates:', ourBooking.checkInDate, '->', ourBooking.checkOutDate);
          } else {
            console.log('[ERROR] Booking BK-2026-051 NOT found after restart!');
            console.log('[DATA] Total bookings after restart:', bookings.length);
          }
          
          apiProcess.kill();
          process.exit(0);
        });
      });
      getReq.end();
    });
  });

  req.write(postData);
  req.end();
}, 3000);

apiProcess.stdout.on('data', (data) => {
  if (data.toString().includes('running on port 4010')) {
    console.log('[API] Restarted and ready');
  }
});
