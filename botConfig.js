// botConfig.js

const fs = require('fs');
const { v4: uuidv4 } = require('uuid'); // Unique ID ke liye

const CONFIG_FILE = 'config.json';
const STATE_FILE = 'state.json';

// ADDED: Global reference to the bot's API instance to stop it later
let currentApiInstance = null;

let config = {
  cookies: null,
  prefix: '/devil',
  adminID: null,
  activeBots: {},
  taskID: null, // NEW: Unique ID for the current session/task
};

let runtimeState = {
  lockedGroups: {},
  lockedNicknames: {}
};

function loadConfigAndState() {
  try {
    // Load Configuration (Credentials)
    const savedConfig = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsedConfig = JSON.parse(savedConfig);
    config.cookies = parsedConfig.cookies;
    config.prefix = parsedConfig.prefix || config.prefix;
    config.adminID = parsedConfig.adminID;
    config.taskID = parsedConfig.taskID || null; // Load existing Task ID
    console.log('✅ Configuration loaded from config.json.');

    // Load State (Locked Groups/Nicknames)
    if (fs.existsSync(STATE_FILE)) {
        const savedState = fs.readFileSync(STATE_FILE, 'utf8');
        const parsedState = JSON.parse(savedState);
        runtimeState.lockedGroups = parsedState.lockedGroups || {};
        runtimeState.lockedNicknames = parsedState.lockedNicknames || {};
        console.log('✅ Runtime state loaded from state.json.');
    }
    
    return true;
  } catch (e) {
    console.log('❌ No saved configuration/state found or error reading files. Will start unconfigured.');
    return false;
  }
}

function saveConfig(newConfig) {
  // Generate a new Task ID only if bot is being configured/restarted, and it's currently not running
  if (!config.taskID || newConfig.cookies || newConfig.adminID) {
    config.taskID = uuidv4(); // Generate new unique ID
  }

  const data = {
    cookies: newConfig.cookies || config.cookies,
    prefix: newConfig.prefix || config.prefix,
    adminID: newConfig.adminID || config.adminID,
    taskID: config.taskID, // Save the Task ID
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
  config = { ...config, ...newConfig, taskID: config.taskID };
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(runtimeState, null, 2));
  console.log('💾 Runtime state saved to state.json.');
}

function getState() {
    return runtimeState;
}

function getConfig() {
    return config;
}

// NEW: Functions to manage the bot API instance
function setCurrentApiInstance(api) {
    currentApiInstance = api;
}

function stopBotByTaskID(inputTaskID) {
    const { taskID, adminID, activeBots } = config;

    if (inputTaskID === taskID && currentApiInstance) {
        // 1. Bot Listening Stop Karo
        try { currentApiInstance.stopListening(); } catch(e) {}
        
        // 2. ActiveBots Map se remove karo
        if (activeBots[adminID]) {
            delete activeBots[adminID];
        }
        
        // 3. Global reference clear karo
        currentApiInstance = null;
        
        // 4. Task ID clear karo taaki same ID se dobara stop na ho sake
        config.taskID = null;
        saveConfig({}); // Config ko save karo taaki Task ID 'null' ho jaye
        
        console.log(`✅ Bot stopped successfully with Task ID: ${inputTaskID}`);
        return true;
    }
    return false;
}

module.exports = {
  loadConfigAndState,
  saveConfig,
  saveState,
  getState,
  getConfig,
  setCurrentApiInstance,
  stopBotByTaskID,
};
