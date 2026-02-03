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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  // Try to sign in with the test user
  console.log('\nAttempting sign in...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (signInError) {
    console.log('Sign in failed:', signInError.message);
    console.log('\nAttempting to create user...');

    // Create the user using admin API
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true
    });

    if (createError) {
      console.log('Create user failed:', createError.message);
    } else {
      console.log('User created successfully:', createData.user.id);

      // Try signing in again
      const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword
      });

      if (retryError) {
        console.log('Retry sign in failed:', retryError.message);
      } else {
        console.log('Sign in after create successful! User ID:', retryData.user.id);
      }
    }
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
      console.log('No Google tokens found:', tokensError.message);
    } else {
      console.log('Google tokens found!');
      console.log('  Scopes:', tokens.scopes);
      console.log('  Expires:', tokens.token_expiry);
      console.log('  Has refresh token:', !!tokens.refresh_token);
    }
  }
}

main().catch(console.error);
