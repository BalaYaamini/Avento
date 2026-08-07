const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env' });
const supabase = require('./config/supabaseClient');

async function testConfirmTeamFlow() {
  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'avento_super_secret_key_12345';
    
    // Leader Token
    const leaderToken = jwt.sign(
      { id: 'cb25ada9-7603-42de-9a82-c2a95f727277', roles: ['student'] },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    // Find two other students to be members
    const { data: students } = await supabase.from('profiles').select('id').eq('role', 'student').neq('id', 'cb25ada9-7603-42de-9a82-c2a95f727277').limit(2);
    const memberId1 = students[0].id;
    const memberId2 = students[1].id;
    
    // Member Tokens
    const member1Token = jwt.sign(
      { id: memberId1, roles: ['student'] },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const member2Token = jwt.sign(
      { id: memberId2, roles: ['student'] },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Set first_login = false for everyone
    await supabase.from('profiles').update({ first_login: false }).in('id', ['cb25ada9-7603-42de-9a82-c2a95f727277', memberId1, memberId2]);

    // Find an existing event with team registration
    const { data: events } = await supabase
      .from('events')
      .select('id, min_team_size, max_team_size, team_leader_registration_required')
      .eq('registration_type', 'team')
      .order('created_at', { ascending: false })
      .limit(1);
      
    const event = events[0];
    const eventId = event.id;
    
    // Set min_team_size to 3 for testing
    console.log("Setting event min_team_size to 3...");
    await supabase.from('events').update({ min_team_size: 3, max_team_size: 4 }).eq('id', eventId);

    // Clean up existing team if any
    const { data: existingTeam } = await supabase.from('event_teams').select('id').eq('leader_id', 'cb25ada9-7603-42de-9a82-c2a95f727277').eq('event_id', eventId).maybeSingle();
    if (existingTeam) {
        console.log("Cleaning up existing team:", existingTeam.id);
        await supabase.from('event_registrations').delete().eq('team_id', existingTeam.id);
        await supabase.from('event_teams').delete().eq('id', existingTeam.id);
    }

    // Clean up existing member individual registrations for this event
    await supabase.from('event_registrations').delete().in('user_id', [memberId1, memberId2, 'cb25ada9-7603-42de-9a82-c2a95f727277']).eq('event_id', eventId);

    // --- TEST 1: Minimum Team Size Check ---
    console.log("\nTEST 1: Leader creating team with only 1 member (total size 2, min is 3)...");
    try {
      await axios.post('http://127.0.0.1:5001/api/registrations/team', {
        eventId,
        teamName: 'Test Confirm Team ' + Date.now(),
        memberIds: [memberId1]
      }, {
        headers: { Authorization: `Bearer ${leaderToken}` }
      });
      console.error("-> FAILED: Expected 400 error for minimum team size, but creation succeeded.");
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log("-> SUCCESS: Backend successfully blocked undersized team. Error:", err.response.data.message);
      } else {
        console.error("-> FAILED: Unexpected error", err.message);
      }
    }

    // --- TEST 2: Organizer check ---
    console.log("\nTEST 2: Attempting to add an organizer as a member...");
    // Let's temporarily make member1 an organizer
    await supabase.from('event_organizers').insert({ event_id: eventId, student_id: memberId1, category: 'Volunteer' });
    try {
      await axios.post('http://127.0.0.1:5001/api/registrations/team', {
        eventId,
        teamName: 'Test Confirm Team ' + Date.now(),
        memberIds: [memberId1, memberId2] // total size 3
      }, {
        headers: { Authorization: `Bearer ${leaderToken}` }
      });
      console.error("-> FAILED: Expected 403 error for organizer, but creation succeeded.");
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log("-> SUCCESS: Backend successfully blocked organizer. Error:", err.response.data.message);
      } else {
        console.error("-> FAILED: Unexpected error", err.message);
      }
    }
    // Clean up organizer
    await supabase.from('event_organizers').delete().eq('event_id', eventId).eq('student_id', memberId1);

    // --- TEST 3: Successful Team Creation and Confirmation ---
    console.log("\nTEST 3: Leader creating pending team with valid size (3)...");
    const regRes = await axios.post('http://127.0.0.1:5001/api/registrations/team', {
      eventId,
      teamName: 'Test Confirm Team ' + Date.now(),
      memberIds: [memberId1, memberId2]
    }, {
      headers: { Authorization: `Bearer ${leaderToken}` }
    });
    
    const teamId = regRes.data.team.id;
    console.log("-> Team created successfully! Team ID:", teamId);

    // Get the members' registration IDs
    const { data: memberRegs } = await supabase
      .from('event_registrations')
      .select('id, user_id')
      .eq('team_id', teamId);
      
    const member1RegId = memberRegs.find(r => r.user_id === memberId1).id;
    const member2RegId = memberRegs.find(r => r.user_id === memberId2).id;

    console.log("\n-> Members accepting invitations...");
    await axios.post(`http://127.0.0.1:5001/api/registrations/${member1RegId}/accept`, {}, {
      headers: { Authorization: `Bearer ${member1Token}` }
    });
    console.log("-> Member 1 accepted.");
    await axios.post(`http://127.0.0.1:5001/api/registrations/${member2RegId}/accept`, {}, {
      headers: { Authorization: `Bearer ${member2Token}` }
    });
    console.log("-> Member 2 accepted.");

    console.log("\n-> Leader confirms team registration...");
    try {
      const confirmRes = await axios.post(`http://127.0.0.1:5001/api/registrations/team/${teamId}/confirm`, {}, {
        headers: { Authorization: `Bearer ${leaderToken}` }
      });
      console.log("-> SUCCESS: Team confirmed successfully. API Response:", confirmRes.data.message);
    } catch (err) {
       console.error("-> FAILED: Confirming team failed with error:", err.response?.data?.message || err.message, err.response?.data?.error);
    }

    // Verify team is registered (requires checking event_registrations since event_teams.status doesn't exist)
    const { data: verifyReg } = await supabase
      .from('event_registrations')
      .select('status')
      .eq('team_id', teamId)
      .eq('user_id', 'cb25ada9-7603-42de-9a82-c2a95f727277')
      .single();
    
    console.log("\n-> Verification: Leader status is now:", verifyReg.status);
    
    console.log("\n--- TEST FLOW COMPLETED ---");

  } catch (err) {
    console.error("\n--- TEST CRASHED ---");
    console.error("Error:", err);
  }
}

testConfirmTeamFlow();
