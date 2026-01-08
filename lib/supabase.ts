import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mppqxptwivobwjnqmfkb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wcHF4cHR3aXZvYndqbnFtZmtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTM2ODcsImV4cCI6MjA4MzQ2OTY4N30.dGVrh2yVMvUFitZOez6ylH3OFuKvrOK43Tbeg6BJqnc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
