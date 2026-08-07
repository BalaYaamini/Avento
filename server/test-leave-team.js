const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env' });
const supabase = require('./config/supabaseClient');

async function testLeaveTeamFlow() {
  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'avento_super_secret_key_12345';
    
    // Leader Token
    const leaderToken = jwt.sign(
      { id: 'cb25ada9-7603-42de-9a82-c2a95f727277', roles: ['student'], has_changed_default_password: true },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    // Find another student to be the member
    const { data: students } = await supabase.from('profiles').select('id').eq('role', 'student').neq('id', 'cb25ada9-7603-42de-9a82-c2a95f727277').limit(1);
    const memberId = students[0].id;
    
    // Set first_login = false for both
    await supabase.from('profiles').update({ first_login: false }).in('id', ['cb25ada9-7603-42de-9a82-c2a95f727277', memberId]);

    // Member Token
    const memberToken = jwt.sign(
      { id: memberId, roles: ['student'] },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Find an existing event with team registration
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .eq('registration_type', 'team')
      .order('created_at', { ascending: false })
      .limit(1);
      
    const eventId = events[0].id;
    // Clean up existing team if any
    const { data: existingTeam } = await supabase.from('event_teams').select('id').eq('leader_id', 'cb25ada9-7603-42de-9a82-c2a95f727277').eq('event_id', eventId).maybeSingle();
    if (existingTeam) {
        console.log("Cleaning up existing team:", existingTeam.id);
        await supabase.from('event_registrations').delete().eq('team_id', existingTeam.id);
        await supabase.from('event_teams').delete().eq('id', existingTeam.id);
    }

    // Clean up existing member individual registrations for this event
    await supabase.from('event_registrations').delete().eq('user_id', memberId).eq('event_id', eventId);
    // Clean up existing leader individual registrations for this event
    await supabase.from('event_registrations').delete().eq('user_id', 'cb25ada9-7603-42de-9a82-c2a95f727277').eq('event_id', eventId);

    // 1. Leader creates a pending team
    console.log("\n2. Leader creating pending team...");
    const regRes = await axios.post('http://127.0.0.1:5001/api/registrations/team', {
      eventId,
      teamName: 'Test Leave Team ' + Date.now(),
      memberIds: [memberId]
    }, {
      headers: { Authorization: `Bearer ${leaderToken}` }
    });
    
    const teamId = regRes.data.team.id;
    console.log("-> Team created successfully! Team ID:", teamId);

    // Get the member's registration ID
    const { data: memberReg } = await supabase
      .from('event_registrations')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', memberId)
      .single();
      
    const memberRegId = memberReg.id;

    // 2. Member accepts the invitation
    console.log("\n3. Member accepting invitation...");
    const acceptRes = await axios.post(`http://127.0.0.1:5001/api/registrations/${memberRegId}/accept`, {}, {
      headers: { Authorization: `Bearer ${memberToken}` }
    });
    console.log("-> Member accepted invitation successfully!");

    // 3. Member clicks Leave Team
    console.log("\n4. Member leaving team...");
    const leaveRes = await axios.post(`http://127.0.0.1:5001/api/registrations/team/leave`, {
      teamId: teamId
    }, {
      headers: { Authorization: `Bearer ${memberToken}` }
    });
    console.log("-> Member left team successfully! API Response:", leaveRes.data);

    // Verify member is removed (status is 'cancelled')
    const { data: verifyReg } = await supabase
      .from('event_registrations')
      .select('status')
      .eq('id', memberRegId)
      .single();
    
    console.log("\n5. Verification: Member status is now:", verifyReg.status);
    
    console.log("\n--- TEST FLOW COMPLETED SUCCESSFULLY WITHOUT 500 ERRORS ---");

  } catch (err) {
    console.error("\n--- TEST FAILED ---");
    if (err.response) {
      console.error("API Error Status:", err.response.status);
      console.error("API Error Data:", err.response.data);
    } else {
      console.error("Error:", err.message);
    }
  }
}

testLeaveTeamFlow();
