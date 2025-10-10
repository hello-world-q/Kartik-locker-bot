// app.js

const express = require('express');
const multer = require('multer');
const login = require('ws3-fca');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// In-memory bot state (consider persisting in production)
let botConfig = null;
let apiInstance = null;

// Serve static HTML form
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve static files if needed

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>(Kartik Rajput Locker) - Bot</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background: linear-gradient(to right, #9932CC, #FF00FF);
        }
        .container {
          max-width: 650px;
          margin: 80px auto;
          background: rgba(0, 0, 0, 0.6);
          border-radius: 15px;
          padding: 30px;
          box-shadow: 0 0 20px rgba(255,255,255,0.2);
        }
        h1 {
          color: white;
          text-align: center;
        }
        .form-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
          color: white;
        }
        input, textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          box-sizing: border-box;
        }
        button {
          width: 100%;
          padding: 14px;
          background: #fc23b2;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s;
          margin-top: 10px;
        }
        button:hover {
          background-color: #45a049;
        }
        .status {
          background: green;
          color: #fff;
          padding: 10px;
          margin-top: 10px;
          border-radius: 8px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>(Kartik Rajput Locker Bot)</h1>
        <form id="botForm" enctype="multipart/form-data">
          <label> Upload Your Appstate.json file:</label><br>
          <input type="file" name="appstate" accept=".json" required /><br><br>
          <label> Command Prefix (e.g., *):</label><br>
          <input type="text" name="prefix" required /><br><br>
          <label> Admin ID:</label><br>
          <input type="text" name="adminID" required /><br><br>
          <button type="submit" onclick="startBot()"> Start Bot</button>
          <button type="button" onclick="stopBot()"> Stop Bot</button>
          <div class="status" id="status">Status: OFF</div>
        </form>
      </div>
      <script>
        async function startBot() {
          const form = document.getElementById('botForm');
          const formData = new FormData(form);
          const status = document.getElementById('status');
          try {
            const response = await fetch('/start-bot', { method: 'POST', body: formData });
            const result = await response.json();
            if (response.ok) {
              status.innerText = 'Status: ON';
              alert('Bot Started: ' + result.message);
            } else {
              status.innerText = 'Status: ERROR';
              alert('Error: ' + result.message);
            }
          } catch (error) {
            status.innerText = 'Status: ERROR';
            alert('Error: ' + error.message);
          }
        }
        async function stopBot() {
          const status = document.getElementById('status');
          try {
            const response = await fetch('/stop-bot', { method: 'POST' });
            const result = await response.json();
            if (response.ok) {
              status.innerText = 'Status: OFF';
              alert('Bot Stopped: ' + result.message);
            } else {
              alert('Error: ' + result.message);
            }
          } catch (error) {
            status.innerText = 'Status: ERROR';
            alert('Error: ' + error.message);
          }
        }
      </script>
    </body>
    </html>
    ${botConfig ? '<p> Bot is running!</p>' : ''}
    `);
});

// Handle form and start bot
app.post('/start-bot', upload.single('appstate'), async (req, res) => {
    try {
        const { prefix, adminID } = req.body;
        if (!req.file || !prefix || !adminID) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        let appState;
        try {
            appState = JSON.parse(fs.readFileSync(req.file.path));
            fs.unlinkSync(req.file.path); // Clean up uploaded file
        } catch (error) {
            return res.status(400).json({ success: false, message: 'Invalid appstate.json file' });
        }

        botConfig = { appState, prefix, adminID };
        await startBot(botConfig);

        res.json({ success: true, message: 'Bot started successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: `Error: ${error.message}` });
    }
});

// Stop bot
app.post('/stop-bot', (req, res) => {
    if (!apiInstance) {
        return res.json({ success: false, message: 'Bot is not running' });
    }
    apiInstance.logout(() => {
        apiInstance = null;
        botConfig = null;
        res.json({ success: true, message: 'Bot stopped successfully' });
    });
});

// Bot logic
async function startBot({ appState, prefix, adminID }) {
    if (apiInstance) {
        throw new Error('Bot is already running');
    }

    return new Promise((resolve, reject) => {
        login({ appState }, (err, api) => {
            if (err) {
                console.error(' Login failed:', err);
                return reject(err);
            }

            console.log(' Bot is running and listening for commands...');
            api.setOptions({ listenEvents: true });
            apiInstance = api;

            const lockedGroups = {};
            const lockedNicknames = {};
            const lockedDPs = {};
            const lockedThemes = {};
            const lockedEmojis = {};

            api.listenMqtt((err, event) => {
                if (err) {
                    console.error(' Listen error:', err);
                    return;
                }

                if (event.type === 'message' && event.body.startsWith(prefix)) {
                    const senderID = event.senderID;
                    const args = event.body.slice(prefix.length).trim().split(' ');
                    const command = args[0].toLowerCase();
                    const input = args.slice(1).join(' ');

                    if (senderID !== adminID) {
                        return api.sendMessage(' You are not authorized to use this command.', event.threadID);
                    }

                    if (command === 'help') {
                        api.sendMessage(`

               


grouplockname (on/off) <name>
nicknamelock (on/off) <name>
groupdplock
groupemojilock
groupthemeslock
tid
uid

          Comming soon : cmnd

target [no <release>


              (K9RT||K - R9JPUT ) 
`, event.threadID);
                    }

                    if (command === 'grouplockname' && args[1] === 'on') {
                        const groupName = input.replace('on', '').trim();
                        lockedGroups[event.threadID] = groupName;
                        api.setTitle(groupName, event.threadID, (err) => {
                            if (err) return api.sendMessage(' Failed to lock group name.', event.threadID);
                            api.sendMessage(` Group name locked as: ${groupName}`, event.threadID);
                        });
                    }

                    if (command === 'nicknamelock' && args[1] === 'on') {
                        const nickname = input.replace('on', '').trim();
                        api.getThreadInfo(event.threadID, (err, info) => {
                            if (err) return console.error(' Error fetching thread info:', err);
                            info.participantIDs.forEach((userID) => {
                                api.changeNickname(nickname, event.threadID, userID, (err) => {
                                    if (err) console.error(` Failed to set nickname for user ${userID}:`, err);
                                });
                            });
                            lockedNicknames[event.threadID] = nickname;
                            api.sendMessage(` Nicknames locked as: ${nickname}`, event.threadID);
                        });
                    }

                    if (command === 'groupdplock' && args[1] === 'on') {
                        lockedDPs[event.threadID] = true;
                        api.sendMessage(' Group DP locked. No changes allowed.', event.threadID);
                    }

                    if (command === 'groupthemeslock' && args[1] === 'on') {
                        lockedThemes[event.threadID] = true;
                        api.sendMessage(' Group themes locked. No changes allowed.', event.threadID);
                    }

                    if (command === 'groupemojilock' && args[1] === 'on') {
                        lockedEmojis[event.threadID] = true;
                        api.sendMessage(' Group emoji locked. No changes allowed.', event.threadID);
                    }

                    if (command === 'tid') {
                        api.sendMessage(`Group UID: ${event.threadID}`, event.threadID);
                    }

                    if (command === 'uid') {
                        api.sendMessage(`Your UID: ${senderID}`, event.threadID);
                    }

                    if (command === 'fyt' && args[1] === 'on') {
                        api.sendMessage(' Fight mode activated! Admin commands enabled.', event.threadID);
                    }
                }

                if (event.logMessageType) {
                    const lockedName = lockedGroups[event.threadID];
                    if (event.logMessageType === 'log:thread-name' && lockedName) {
                        api.setTitle(lockedName, event.threadID, () => {
                            api.sendMessage(' Group name change reverted.', event.threadID);
                        });
                    }

                    const lockedNickname = lockedNicknames[event.threadID];
                    if (event.logMessageType === 'log:thread-nickname' && lockedNickname) {
                        const affectedUserID = event.logMessageData.participant_id;
                        api.changeNickname(lockedNickname, event.threadID, affectedUserID, () => {
                            api.sendMessage(' Nickname change reverted.', event.threadID);
                        });
                    }

                    if (event.logMessageType === 'log:thread-icon' && lockedEmojis[event.threadID]) {
                        api.changeThreadEmoji('', event.threadID, () => {
                            api.sendMessage(' Emoji change reverted.', event.threadID);
                        });
                    }

                    if (event.logMessageType === 'log:thread-theme' && lockedThemes[event.threadID]) {
                        api.sendMessage(' Theme change reverted.', event.threadID);
                    }

                    if (event.logMessageType === 'log:thread-image' && lockedDPs[event.threadID]) {
                        api.sendMessage(' Group DP change reverted.', event.threadID);
                    }
                }
            });

            resolve();
        });
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(` Web panel running on http://0.0.0.0:${PORT}`);
});