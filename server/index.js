import 'dotenv/config'
import express from 'express'
import mysql from 'mysql2/promise'

const app = express()
const port = Number(process.env.API_PORT || 3001)

const database = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'chat_app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  supportBigNumbers: true,
  bigNumberStrings: true,
  dateStrings: true,
})

app.disable('x-powered-by')
app.use(express.json({ limit: '16kb' }))

app.get('/api/health', async (_request, response) => {
  try {
    await database.query('SELECT 1')
    response.json({ status: 'ok', database: 'connected' })
  } catch (error) {
    console.error('Chat database health check failed:', error)
    response.status(503).json({ error: 'MySQL is unavailable. Check your database and .env settings.' })
  }
})

app.get('/api/messages', async (request, response) => {
  const afterId = request.query.after_id

  try {
    let messages
    if (afterId !== undefined) {
      if (typeof afterId !== 'string' || !/^\d+$/.test(afterId)) {
        return response.status(400).json({ error: 'The message cursor must be a non-negative integer.' })
      }
      ;[messages] = await database.execute(
        `SELECT id, sender_name, message, created_at
         FROM messages
         WHERE id > ?
         ORDER BY id ASC
         LIMIT 100`,
        [afterId],
      )
    } else {
      ;[messages] = await database.query(
        `SELECT id, sender_name, message, created_at
         FROM (
           SELECT id, sender_name, message, created_at
           FROM messages
           ORDER BY id DESC
           LIMIT 100
         ) AS recent_messages
         ORDER BY id ASC`,
      )
    }

    response.set('Cache-Control', 'no-store').json({ messages })
  } catch (error) {
    console.error('Could not load chat messages:', error)
    response.status(503).json({ error: 'The chat database is unavailable. Check that MySQL is running and the schema is imported.' })
  }
})

app.post('/api/messages', async (request, response) => {
  const { sender_name: senderName, message } = request.body ?? {}
  if (typeof senderName !== 'string' || typeof message !== 'string') {
    return response.status(422).json({ error: 'Enter a display name and a message.' })
  }

  const cleanName = senderName.trim()
  const cleanMessage = message.trim()
  if (!cleanName || cleanName.length > 32) {
    return response.status(422).json({ error: 'Display names must be between 1 and 32 characters.' })
  }
  if (!cleanMessage || cleanMessage.length > 2000) {
    return response.status(422).json({ error: 'Messages must be between 1 and 2,000 characters.' })
  }

  try {
    const [insert] = await database.execute(
      'INSERT INTO messages (sender_name, message) VALUES (?, ?)',
      [cleanName, cleanMessage],
    )
    const [rows] = await database.execute(
      'SELECT id, sender_name, message, created_at FROM messages WHERE id = ?',
      [insert.insertId],
    )
    if (!rows[0]) throw new Error('Inserted chat message was not available for reading.')
    response.status(201).json({ message: rows[0] })
  } catch (error) {
    console.error('Could not save chat message:', error)
    response.status(503).json({ error: 'Could not save your message. Check that MySQL is running and the schema is imported.' })
  }
})

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return response.status(400).json({ error: 'Send valid JSON.' })
  }
  if (error.type === 'entity.too.large') {
    return response.status(413).json({ error: 'The request is too large.' })
  }
  console.error('Unexpected chat API error:', error)
  return response.status(500).json({ error: 'The chat server encountered an unexpected error.' })
})

app.listen(port, () => {
  console.log(`Chat API listening at http://localhost:${port}`)
})
