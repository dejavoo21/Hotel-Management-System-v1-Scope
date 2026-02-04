// Start the API and make a request to it, then check if data persists
const http = require('http');
const { spawn } = require('child_process');

const apiProcess = spawn('node', ['packages/api/dist/index.js'], {
  cwd: 'c:\\Users\\walea\\playwright-agents\\Hotel Management System v1 scope\\CLAUDE',
  stdio: ['ignore', 'pipe', 'pipe']
});

// Wait for API to start
setTimeout(() => {
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
      console.log('[LOGIN] Status:', res.statusCode);
      try {
        const json = JSON.parse(data);
        console.log('[LOGIN] Token:', json.data?.accessToken?.substring(0, 20) + '...');
        
        // Now create a booking
        const bookingData = JSON.stringify({
          guestId: 'guest-1',
          roomId: 'room-101',
          checkInDate: '2026-02-05',
          checkOutDate: '2026-02-07',
          numberOfGuests: 2,
          source: 'DIRECT'
        });
        
        const bookingReq = http.request({
          hostname: 'localhost',
          port: 4010,
          path: '/api/bookings',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${json.data.accessToken}`,
            'Content-Length': Buffer.byteLength(bookingData)
          }
        }, (res) => {
          let bookingRes = '';
          res.on('data', chunk => bookingRes += chunk);
          res.on('end', () => {
            console.log('[BOOKING] Status:', res.statusCode);
            console.log('[BOOKING] Created:', JSON.parse(bookingRes).data?.bookingRef);
            
            // Check if the file was created
            const fs = require('fs');
            setTimeout(() => {
              const filePath = 'c:\\Users\\walea\\playwright-agents\\Hotel Management System v1 scope\\CLAUDE\\packages\\api\\data\\demo-store.json';
              if (fs.existsSync(filePath)) {
                console.log('[SUCCESS] demo-store.json was created!');
                const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                console.log('[DATA] Total bookings saved:', content.mockBookings.length);
              } else {
                console.log('[ERROR] demo-store.json was NOT created');
              }
              
              apiProcess.kill();
              process.exit(0);
            }, 1000);
          });
        });
        
        bookingReq.write(bookingData);
        bookingReq.end();
      } catch (e) {
        console.error('[ERROR]', e.message);
        apiProcess.kill();
        process.exit(1);
      }
    });
  });

  req.on('error', (e) => {
    console.error('[HTTP ERROR]', e.message);
    apiProcess.kill();
    process.exit(1);
  });

  req.write(postData);
  req.end();
}, 3000);

apiProcess.stdout.on('data', (data) => {
  if (data.toString().includes('running on port 4010')) {
    console.log('[API] Started and ready');
  }
});

apiProcess.stderr.on('data', (data) => {
  console.error('[API STDERR]', data.toString());
});
