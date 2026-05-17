// netlify/functions/games.js
// Grid Survival — Game Data API
// Handles GET (list), POST (add), DELETE (remove) for game catalog

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // NOTE: This is a stateless demo function.
  // For persistent storage, connect Netlify Blobs or a database (e.g. FaunaDB, Supabase).
  // The admin panel uses localStorage for client-side persistence.

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: 'ok', message: 'Use admin panel for game management. Storage is client-side via localStorage.' })
    };
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'ok', received: body })
      };
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};
