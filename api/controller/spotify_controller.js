const axios = require('axios');
const dummy_id_placeholder = '!@#$%^&*()_';

function shuffle(list) {
  let max = list.length - 1;
  let min;
  let picked;

  for (let i = 0; i < list.length - 1; i++) {
    min = i
    picked = Math.floor(Math.random() * (max - min + 1)) + min; // Returns a random integer between min (include) and max (include)
    [list[i], list[picked]] = [list[picked], list[i]];
  }

  return list;
}

async function bulk_fetch_randomized_items(endpoint, access_token, objs, batch_limit, callback) {
  const limit = 50
  let continue_fetch = true;
  let page = 0;
  let result = [];
  let api_res;
  let parsed_data;

  for (let i in objs) {
    let obj_endpoint = endpoint.replace(dummy_id_placeholder, objs[i]);
    let batch = [];
    continue_fetch = true;
    page = 0;

    while(continue_fetch) {
      const fetch_options = {
        url: `${obj_endpoint}limit=${limit}&offset=${page*limit}`,
        headers: { Authorization: `Bearer ${access_token}` },
        json: true
      };

      api_res = await axios(fetch_options);
      parsed_data = callback(api_res);

      const items = parsed_data[0];
      continue_fetch = (parsed_data[1] != null);

      batch.push(...items);
      page += 1;
    }

    batch = shuffle(batch);
    if (batch.length > batch_limit) {
      batch = batch.slice(0, batch_limit);
    }

    result.push(...batch);
  }

  return result;
}


module.exports = {

  recommendedSongSelection: async (req, res) => {
    const access_token = req.body.access_token;
    const categories = req.body.categories;
    const category_endpoint = `https://api.spotify.com/v1/browse/categories/${dummy_id_placeholder}/playlists?country=CA&`;
    const playlist_endpoint = `https://api.spotify.com/v1/playlists/${dummy_id_placeholder}/tracks?`;
    const max_playlists_per_category = 1;
    const max_tracks_per_playlist = 5;
    const max_result_tracks = 10;

    let playlists = [];
    let tracks = [];
    let track_batch = [];

    try {
      playlists = await bulk_fetch_randomized_items(category_endpoint, access_token, categories, max_playlists_per_category, (response) => {
        let res_data = response.data;
        let items = res_data.playlists.items.map(item => { return item.id; });
        let next = res_data.playlists.next;

        return [items, next];
      });
    } catch(error) {
      return res.json(error.response.data);
    }
    
    for (let i in playlists) {
      try {
        track_batch = await bulk_fetch_randomized_items(playlist_endpoint, access_token, playlists, max_tracks_per_playlist, (response) => {
          let res_data = response.data;
          let items = res_data.items.map(item => { return { id: item.track.id, name: item.track.name, artist: item.track.artists[0].name }; });
          let next = res_data.next;

          return [items, next];
        });
      } catch(error) {
        return res.json(error.response.data);
      }

      tracks.push(...track_batch);
    }

    tracks = shuffle(tracks);
    if (tracks.length > max_result_tracks) {
      tracks = tracks.slice(0, max_result_tracks);
    }

    res.json({ recommended_tracks : tracks });
  }
}
