const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      process.env[key] = valueParts.join('=');
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const testEmail = process.env.TEST_USER_EMAIL;
const testPassword = process.env.TEST_USER_PASSWORD;

console.log('Supabase URL:', supabaseUrl);
console.log('Test email:', testEmail);
console.log('New password:', testPassword);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  // List all users to find the test user
  console.log('\nListing users...');
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.log('Failed to list users:', listError.message);
    return;
  }

  const testUser = users.find(u => u.email === testEmail);

  if (!testUser) {
    console.log('Test user not found!');
    return;
  }

  console.log('Found test user:', testUser.id);
  console.log('Email:', testUser.email);
  console.log('Created at:', testUser.created_at);

  // Update the password
  console.log('\nUpdating password...');
  const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
    testUser.id,
    { password: testPassword }
  );

  if (updateError) {
    console.log('Failed to update password:', updateError.message);
    return;
  }

  console.log('Password updated successfully!');

  // Try signing in with new password
  console.log('\nVerifying sign in...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (signInError) {
    console.log('Sign in failed:', signInError.message);
  } else {
    console.log('Sign in successful! User ID:', signInData.user.id);

    // Check for Google tokens
    console.log('\nChecking for Google tokens...');
    const { data: tokens, error: tokensError } = await supabase
      .from('google_tokens')
      .select('*')
      .eq('user_id', signInData.user.id)
      .single();

    if (tokensError) {
      console.log('No Google tokens found (need to authorize)');
    } else {
      console.log('Google tokens found!');
      console.log('  Scopes:', tokens.scopes);
      console.log('  Expires:', tokens.token_expiry);
      console.log('  Has refresh token:', !!tokens.refresh_token);
    }
  }
}

main().catch(console.error);
