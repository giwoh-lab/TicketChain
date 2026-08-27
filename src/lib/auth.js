/**
 * Demo authentication module.
 * Uses localStorage to persist registered users and the current session.
 * NOT production-grade – purely for prototype demonstration.
 */

const USERS_KEY = "ctm_users";
const SESSION_KEY = "ctm_session";

function getUsers() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/**
 * Register a new user.
 * @returns {{ success: boolean, error?: string }}
 */
export function registerUser({ username, email, password }) {
  const users = getUsers();
  if (users.find((u) => u.email === email)) {
    return { success: false, error: "Email already registered." };
  }
  users.push({ username, email, password });
  saveUsers(users);
  return { success: true };
}

/**
 * Log in with email + password.
 * @returns {{ success: boolean, user?: object, error?: string }}
 */
export function loginUser({ email, password }) {
  const users = getUsers();
  const user = users.find((u) => u.email === email && u.password === password);
  if (!user) {
    return { success: false, error: "Invalid email or password." };
  }
  const session = { username: user.username, email: user.email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { success: true, user: session };
}

/**
 * Get the currently logged-in user (or null).
 */
export function getCurrentUser() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

/**
 * Log out the current user.
 */
export function logoutUser() {
  localStorage.removeItem(SESSION_KEY);
}
