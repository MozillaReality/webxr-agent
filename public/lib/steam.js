const SteamUser = require('steam-user');

const client = new SteamUser();

const LOGON_TIMEOUT = 10000;  // 10 seconds.

const logIn = module.exports.logIn = function (opts) {
  opts = opts || {};
  return new Promise((resolve, reject) => {
    var loggedIn = false;

    client.logOn({
      accountName: opts.user,
      password: opts.password
    });

    client.on('loggedOn', gotStatus);

    client.on('error', gotError);

    if (!loggedIn) {
      setTimeout(() => {
        if (loggedIn) {
          return;
        }
        gotError(new Error('Steam API authentication timeout occurred'));
      }, LOGON_TIMEOUT);
    }

    function gotStatus (details) {
      loggedIn = true;
      // client.off('loggedOn', gotStatus);
      console.log('Logged on to Steam as "%s"', client.steamID.getSteam3RenderedID());
      client.setPersona(SteamUser.EPersonaState.Online);
      client.gamesPlayed(process.env.STEAM_APP_ID);
      resolve(details);
    }

    function gotError (err) {
      loggedIn = false;
      // client.off('error', gotError);
      reject(err);
      console.error('Steam error occurred:', err);
    }
  });
};

/*
client.on('loggedOn', details => {
  console.log('Logged on to Steam as %s', client.steamID.getSteam3RenderedID());
  client.setPersona(SteamUser.EPersonaState.Online);
  client.gamesPlayed(process.env.STEAM_APP_ID);
});

client.on('error', err => {
  console.error('Steam error occurred:', err);
});
*/

client.on('webSession', (sessionID, cookies) => {
  console.log('Got Steam web session');
});

client.on('newItems', count => {
  console.log(`${count} new items in our inventory`);
});

client.on('emailInfo', (address, validated) => {
  const status = validated ? 'validated' : 'not validated';
  console.log(`Email address: ${address} (status: ${status})`,
    address, status);
});

client.on('wallet', (hasWallet, currency, balance) => {
  const balanceFormatted = SteamUser.formatCurrency(balance, currency);
  console.log('Wallet balance:', balanceFormatted);
});

client.on('accountLimitations', (limited, communityBanned, locked, canInviteFriends) => {
  let limitations = [];

  if (limited) {
    limitations.push('LIMITED');
  }

  if (communityBanned) {
    limitations.push('COMMUNITY BANNED');
  }

  if (locked) {
    limitations.push('LOCKED');
  }

  if (limitations.length) {
    console.log(`Account is ${limitations.join(', ')}`);
  } else {
    console.log('Account has no limitations');
  }

  if (canInviteFriends) {
    console.log('Account can invite friends');
  }
});

client.on('vacBans', (numBans, appids) => {
  console.log('Account has %s VAC %s',
    numBans,
    numBans === 1 ? 'ban' : 'bans');

  if (appids.length) {
    console.log('Account is VAC banned from apps: %s',
      appids.join(', '));
  }
});

client.on('licenses', licenses => {
  console.log('Our account owns %s %s',
    licenses.length,
    licenses.length === 1 ? 'license' : 'license');
});

// logIn({
//   user: 'user',
//   password: 'password'
// }).then(details => {
//   const response = Object.assign({}, details, {
//     success: true
//   });
//   // res.send(response);
// });

module.exports = client;
