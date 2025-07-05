Sure! Here's your `README.md` in **English**:

---

#  Whale Referral Game (Telegram WebApp)

A simple Telegram WebApp game with a Flask backend and SQLite database. Users complete tasks, earn bananas, compete on the leaderboard, and fight to become the **King of the Hill** 👑.

---

##  Tech Stack

* **Backend:** Python + Flask
* **Database:** SQLite
* **Frontend:** HTML + CSS + JavaScript 
* **Telegram Bot API** integration

---

##  Setup & Run

### 1. Clone the repository

```bash
git clone https://github.com/santoridev/whale-game.git
cd whale-game
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

> Requires Python 3.9 or higher.

### 3. Set up environment variables (optional)

Create a `.env` file and add your bot token:

```
BOT_TOKEN=your_telegram_bot_token
```

Or set the token directly in the `BOT_TOKEN` variable inside `app.py`.

### 4. Start the server

```bash
python app.py
```

The server will run at `http://localhost:5000`

---

##  How It Works

1. A user opens the WebApp via your Telegram bot.
2. The frontend sends `initData` from Telegram to your backend.
3. The backend verifies the Telegram WebApp auth signature.
4. The user is registered (if not already) and optionally linked to a referrer.
5. The user:

   * Sees available tasks
   * Completes them (e.g., invite 3 friends)
   * Earns banana rewards
   * Appears in the leaderboard
   * May become the **King of the Hill**

---

##  API Endpoints

| Method | Route                | Description                           |
| ------ | -------------------- | ------------------------------------- |
| POST   | `/auth`              | Authenticate user via Telegram WebApp |
| GET    | `/get_user_state`    | Get user data                         |
| POST   | `/update_user_state` | Update user info (bananas, welcome)   |
| GET    | `/leaderboard`       | Get leaderboard data                  |
| GET    | `/tasks`             | Get available tasks                   |
| POST   | `/tasks`             | Mark a task as completed              |

---

## Database Structure (SQLite)

* `users` — Stores user info, referral data, and banana count
* `user_tasks` — Tracks task completion per user
* `tasks` — List of all available tasks
* `king_of_the_hill` — The current "king" player with expiry

> Tables are created automatically on the first run.

---

##  Game Features

* Telegram WebApp authentication
* Referral system (track invited friends)
* Task & reward system
* Global leaderboard
* King of the Hill feature
* Automatic seeding of default tasks

---

## Frontend (WebApp)

Located at `templates/index.html`
Loads in Telegram as a WebApp via a button or deep link.

### Uses:

* `window.Telegram.WebApp.initData` for auth
* JavaScript fetch requests to interact with the backend

---

##  Telegram Bot Setup

1. Create a bot with [@BotFather](https://t.me/BotFather)
2. Set the WebApp button using the `WebAppInfo` option (URL should point to your hosted frontend, e.g. `https://your-domain.com`)
3. Optionally, pass a `start_param` for referral tracking

---

##  Security

* Auth data is verified using Telegram's `initData` via HMAC-SHA256
* Sensitive data (like banana balance) is securely stored
* Users can't spoof progress — everything is validated server-side



