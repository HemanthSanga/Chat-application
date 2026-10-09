# Commonroom chat

A single-room chat application built with React, Express, and MySQL. It stores messages in MySQL and checks for new messages every two seconds.

## Requirements

- Node.js 20.19+ or 22.12+ and npm
- XAMPP with Apache, MySQL, and phpMyAdmin (Apache is needed for phpMyAdmin; the app itself runs on Node)

## Setup with XAMPP

1. Start **MySQL** in the XAMPP Control Panel. Apache is optional unless you plan to open phpMyAdmin.
2. Open `http://localhost/phpmyadmin/`, choose **Import**, select the project's `schema.sql`, and click **Import**. This creates the `chat_app` database and its `messages` table. Alternatively, paste `schema.sql` into phpMyAdmin's SQL tab and run it.
3. In the project folder, create a `.env` file by copying `.env.example`. The defaults (`root`, blank password, port `3306`) match a typical local XAMPP installation. If your MySQL settings differ, update `.env`.
4. Open a terminal in the project folder and run:

   ```bash
   npm install
   npm run dev
   ```

5. Open the local address printed by Vite, usually `http://localhost:5173`.

The `npm run dev` command runs both the React dev server and the Express API. It is not necessary to copy the app into `htdocs` or open an HTML file directly.

## Features

- Choose or change a display name.
- Send messages with Enter, or add a line break with Shift+Enter.
- View the latest 100 messages; new messages are picked up every two seconds.
- Persist messages with MySQL and parameterized API queries.

This is a local/demo chat: the room is shared, and display names are not authenticated. People who can access the app can read and send messages. Do not expose it to the public internet without adding authentication and appropriate abuse controls.
