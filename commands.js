// commands.js

const { getConfig, getState, saveState } = require('./botConfig');

async function handleCommands(api, event) {
    const { threadID, senderID, body, mentions } = event;
    const config = getConfig();
    const state = getState();
    const isAdmin = String(senderID) === String(config.adminID);

    const parts = body.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // --- COMMANDS ---

    // tid
    if (command === 'tid') {
        try { await api.sendMessage(`Group ID: ${threadID}`, threadID); } catch(e) {}
        return true;
    }

    // uid [@mention]
    if (command === 'uid') {
        let userID = senderID;
        if (mentions && Object.keys(mentions).length > 0) {
            userID = Object.keys(mentions)[0];
        }
        try { await api.sendMessage(`User ID: ${userID}`, threadID); } catch(e) {}
        return true;
    }

    // group on <name>
    if (command === 'group' && args[0] === 'on') {
        if (!isAdmin) { await api.sendMessage("Permission denied. Only admin can use this command.", threadID); return true; }
        const name = args.slice(1).join(' ');
        if (!name) { await api.sendMessage("Usage: group on <new name>", threadID); return true; }
        
        state.lockedGroups[threadID] = name;
        saveState(); // Save to disk
        
        try { 
            await api.changeThreadName(name, threadID); 
        } catch (e) { 
            console.error('changeThreadName error:', e); 
            await api.sendMessage(`Error setting group name: ${e.message}`, threadID);
            return true;
        }
        
        await api.sendMessage(`Group name locked to: **${name}**.`, threadID);
        return true;
    }

    // group off
    if (command === 'group' && args[0] === 'off') {
        if (!isAdmin) { await api.sendMessage("Permission denied. Only admin can use this command.", threadID); return true; }
        delete state.lockedGroups[threadID];
        saveState(); // Save to disk
        await api.sendMessage(`Group name unlocked.`, threadID);
        return true;
    }

    // nickname on <nick>
    if (command === 'nickname' && args[0] === 'on') {
        if (!isAdmin) { await api.sendMessage("Permission denied. Only admin can use this command.", threadID); return true; }
        const nick = args.slice(1).join(' ');
        if (!nick) { await api.sendMessage("Usage: nickname on <new nickname>", threadID); return true; }

        state.lockedNicknames[threadID] = nick;
        saveState(); // Save to disk

        // Apply nickname to all participants (except admin)
        try {
            const threadInfo = await api.getThreadInfo(threadID);
            for (const pid of threadInfo.participantIDs) {
                if (String(pid) !== String(config.adminID)) {
                    try { 
                        await api.changeNickname(nick, threadID, pid); 
                    } catch (e) {
                        // Log but continue for other members
                        console.error(`Error setting nick for ${pid}: ${e.message}`);
                    }
                }
            }
        } catch (e) { 
            console.error('getThreadInfo error:', e); 
            await api.sendMessage(`Error applying nicknames: ${e.message}`, threadID);
            return true;
        }

        await api.sendMessage(`All nicknames locked to: **${nick}**.`, threadID);
        return true;
    }

    // nickname off
    if (command === 'nickname' && args[0] === 'off') {
        if (!isAdmin) { await api.sendMessage("Permission denied. Only admin can use this command.", threadID); return true; }
        delete state.lockedNicknames[threadID];
        saveState(); // Save to disk
        await api.sendMessage(`Nicknames unlocked.`, threadID);
        return true;
    }

    // If no command matched
    return false;
}

module.exports = {
    handleCommands
};
