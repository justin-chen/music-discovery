const spotify_manager = require('../managers/spotify_manager');
// Redis stuff
const redis = require('redis');
const client = redis.createClient();

client.on('error', err => {
  console.log('Something went wrong ', err)
});

const insertToRedis = (key, value) => {
  console.log("Inserting to redis");
  client.set(key, value);
}

const fetchFromRedis = (key, callback) => {
  client.get(key, (error, result) => {
    if (error) throw error;
    console.log("Fetching from redis");
    return callback(result);
  });
}

// Request stuff
const request = require('request');
const client_id = process.env.CLIENT_ID; // Your client id
const client_secret = process.env.CLIENT_SECRET; // Your secret

const sendAsJSON = (res, error, response, body) => {
  if (!error && response.statusCode === 200) {
    res.json(body);
  } else {
    res.status(response.statusCode).json(error);
  }
}

const genreFetchOptions = accessToken => {
  const option = {
    url: 'https://api.spotify.com/v1/browse/categories?limit=50',
    headers: { Authorization: `Bearer ${accessToken}` },
    json: true
  };
  return option;
};

const getAppToken = callback => {
  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      grant_type: 'client_credentials'
    },
    headers: {
      'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
    },
    json: true
  };

  request.post(authOptions, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      insertToRedis('AppAuthToken', body.access_token);
      return callback(body.access_token);
    } else {
      return null;
    }
  });
}

// Export functions
module.exports = {
  allGenres: (req, res) => {
    fetchFromRedis('AppAuthToken', token => {
      if (token) {
        request.get(genreFetchOptions(token), (error, response, body) => {
          if (!error && response.statusCode === 200) {
            spotify_manager.filterGenres(body);
            res.json(body);
          } else if (response.statusCode === 401) {
            getAppToken(token => {
              request.get(genreFetchOptions(token), (error, response, body) => sendAsJSON(res, error, response, body)); 
            });
          } else {
            res.status(response.statusCode).json(error);
          }
        }); 
      } else {
        getAppToken(token => {
          request.get(genreFetchOptions(token), (error, response, body) => sendAsJSON(res, error, response, body)); 
        });
      }
    }); 
  }
}