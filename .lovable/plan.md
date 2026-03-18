

# Rewards Dashboard Redesign

## Problem
1. The rewards page looks bare and unfinished — plain text blocks, no visual hierarchy
2. Shows "0 users joined" because the `social_rewards` table is empty (join flow may have failed or user hasn't completed it)
3. No "Update Data" button for manual tweet scanning
4. No leaderboard, no post history panel, no verification badges
5. No per-user scan with 1-hour cooldown

## Plan

### 1. New Edge Function: `check-social-rewards-user`
A per-user scan function (distinct from the batch `check-social-rewards` cron):
- Accepts `{ twitterUsername, socialRewardId }` 
- Enforces **1-hour cooldown** by checking `last_checked_at` timestamp on the `social_rewards` row
- Fetches last 10 tweets via `twitterapi.io` (`/twitter/user/last_tweets`)
- Filters tweets newer than `last_checked_post_id`
- Checks for `$saturn` / `@saturnterminal` keywords
- Inserts reward events (mention + engagement points) into `social_reward_events`
- Updates `social_rewards.points`, `last_checked_at`, `last_checked_post_id`
- Returns: `{ success, pointsEarned, tweetsChecked, nextUpdateAt, newEvents[] }`

### 2. Complete Redesign of `RewardsPage.tsx`
Replace the current page with a proper dashboard layout:

**Left Column / Main Area:**
- **Profile Card** — avatar, display name, @username, verified badge (if `twitter_followers > 10000` = gold, `> 1000` = blue), follower count, join date
- **Points Display** — large prominent points counter with animated number
- **"Update Data" Button** — triggers `check-social-rewards-user`, shows cooldown timer if < 1 hour since last check, displays remaining time
- **Qualifying Posts Panel** — scrollable list of all `social_reward_events` grouped by tweet, showing post text preview, link to tweet, individual point breakdowns (mention/views/RTs/comments), timestamps

**Right Column / Sidebar:**
- **Point System Card** (existing, refined styling)
- **Leaderboard** — top 10 users by points from `social_rewards` table, showing rank, avatar, username, points. Highlight current user's position
- **Stats** — total users joined, total points distributed, user's rank

**Pre-join states** (login, link X, join) remain as centered cards but with improved styling matching the dashboard aesthetic.

### 3. Database — No Schema Changes Needed
The existing `social_rewards` and `social_reward_events` tables have all necessary columns. RLS already allows public reads and service-role writes.

### 4. Fix "0 Users" Issue  
The count query works but the table is empty. Ensure `handleJoin` properly calls `social-rewards-join` and surface any errors. Add a fallback auto-join on page load if Twitter is linked but no reward row exists.

### 5. Leaderboard Component
New `RewardsLeaderboard` component:
- Fetches top 20 from `social_rewards` ordered by `points DESC`
- Shows rank badges (gold/silver/bronze for top 3)
- Highlights current user row
- Shows avatar, username, points

### Expansion Ideas
- **Referral system** — unique invite links, bonus points for referred users who join
- **Weekly/monthly challenges** — bonus multipliers for posting streaks
- **Tier system** — Bronze/Silver/Gold/Platinum based on cumulative points, each tier unlocks perks
- **Post templates** — one-click tweet composer with pre-filled $SATURN mentions
- **Achievement badges** — "First Post", "100 Points", "Top 10 Leaderboard", etc.
- **Points redemption** — convert points to token airdrops or whitelist spots

