// handlers.js

const { getConfig, getState, saveState } = require('./botConfig');

// handle thread name change
async function handleThreadNameChange(api, event) {
    const { threadID, authorID } = event;
    const { adminID } = getConfig();
    const { lockedGroups } = getState();

    if (lockedGroups[threadID] && String(authorID) !== String(adminID)) {
        try { 
            await api.changeThreadName(lockedGroups[threadID], threadID); 
        } catch (e) {
            console.error('changeThreadName revert error:', e);
        }
        try { 
            // Simple message
            await api.sendMessage(`Group name is locked to: ${lockedGroups[threadID]}. Only the admin can change it.`, threadID); 
        } catch (e) {}
    }
}

// handle nickname change (IMPROVED)
async function handleNicknameChange(api, event) {
    const { threadID, authorID, participantID, nickname } = event;
    const { adminID } = getConfig();
    const { lockedNicknames } = getState();
    
    // Check if locking is active for this thread
    if (lockedNicknames[threadID]) {
        const requiredNickname = lockedNicknames[threadID];
        
        // Agar change karne wala Admin hai, toh allow karo (agar woh kisi aur ka change kar raha hai toh bhi)
        if (String(authorID) === String(adminID)) {
            // Admin ka change allowed hai, lekin agar Admin kisi aur member ka nickname uss locked nickname se
            // different set kar raha hai, toh woh allowed hai. Isliye yahan hum sirf non-admin changes ko pakdenge.
            return;
        }
        
        // Agar koi non-admin participant ka nickname change karta hai aur naya nickname locked nickname se match nahi karta
        if (String(nickname) !== String(requiredNickname)) {
            try { 
                // Nickname ko locked value pe revert karo
                await api.changeNickname(requiredNickname, threadID, participantID); 
            } catch (e) {
                console.error('changeNickname revert error:', e);
            }
            
            // Revert message sirf tab bhejo jab change karne wala Admin na ho (security/spam se bachne ke liye)
            try { 
                await api.sendMessage(`Nickname for this member is locked to: ${requiredNickname}. Only the admin can change it.`, threadID); 
            } catch (e) {}
        }
    }
}


module.exports = {
    handleThreadNameChange,
    handleNicknameChange
};
