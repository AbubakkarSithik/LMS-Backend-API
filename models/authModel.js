import supabase from "../config/supabase.js";

// --- SIGNUP ---
export const signUpUser = async (email, password, redirectTo) => {
  return await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectTo },
  });
};

// --- LOGIN ---
export const loginUser = async (email, password) => {
  return await supabase.auth.signInWithPassword({ email, password });
};

// --- GET USER FROM TOKEN ---
export const getUserByAccessToken = async (access_token) => {
  return await supabase.auth.getUser(access_token);
};

// --- UPDATE PASSWORD ---
export const updateUserPassword = async (new_password) => {
  return await supabase.auth.updateUser({ password: new_password });
};

// --- REFRESH SESSION ---
export const refreshSession = async (refresh_token) => {
  return await supabase.auth.refreshSession({ refresh_token });
};
