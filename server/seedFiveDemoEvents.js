// server/seedFiveDemoEvents.js
require('dotenv').config();
const supabase = require('./config/supabaseClient');

const defaultFeedbackQuestions = [
  {
    id: 'q_content',
    type: 'rating',
    label: 'Event Content & Organization',
    required: true
  },
  {
    id: 'q_speaker',
    type: 'rating',
    label: 'Speaker / Facilitators Quality',
    required: false
  },
  {
    id: 'q_overall',
    type: 'rating',
    label: 'Overall Satisfaction',
    required: true
  },
  {
    id: 'q_suggestions',
    type: 'text',
    label: 'Suggestions for Improvement',
    required: false
  }
];

const eventsToCreate = [
  {
    title: 'AI NextGen Hackathon 2026: Autonomous Agents & LLMs',
    description: 'A 24-hour national hackathon for student builders and developers to design cutting-edge autonomous agents, multi-modal workflows, and generative AI systems. Over ₹1,00,000 in cash prizes, cloud credits, and startup incubation opportunities!',
    category: 'Technical',
    venue: 'Turing Hall & Computing Lab 4, Tech Block',
    date: '2026-11-15T09:00:00.000Z',
    end_date: '2026-11-16T17:00:00.000Z',
    registration_deadline: '2026-11-12T23:59:59.000Z',
    status: 'published',
    registration_type: 'team',
    min_team_size: 2,
    max_team_size: 4,
    max_teams: 40,
    capacity: 160,
    allow_cross_department: true,
    team_leader_registration_required: true,
    join_team_enabled: true,
    image_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800',
    payment_enabled: false,
    scoring_enabled: true,
    scoreboard_visible: true,
    feedback_questions: defaultFeedbackQuestions
  },
  {
    title: 'Aura 2026: Inter-College Dance & Music Fiesta',
    description: 'The premier cultural celebration of music, rhythm, and stagecraft. Featuring Western & Eastern solo vocal rounds, group choreography battles, and an evening celebrity DJ night. Open for all departments and colleges!',
    category: 'Cultural',
    venue: 'Open Air Amphitheatre & Central Stage',
    date: '2026-11-20T17:00:00.000Z',
    end_date: '2026-11-20T22:00:00.000Z',
    registration_deadline: '2026-11-18T23:59:59.000Z',
    status: 'published',
    registration_type: 'individual',
    capacity: 300,
    min_team_size: 1,
    max_team_size: 1,
    allow_cross_department: true,
    team_leader_registration_required: true,
    join_team_enabled: false,
    image_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800',
    payment_enabled: false,
    scoring_enabled: false,
    scoreboard_visible: false,
    feedback_questions: defaultFeedbackQuestions
  },
  {
    title: 'Apex Arena: Inter-Department Valorant & Futsal League',
    description: 'A hybrid tournament uniting high-octane esports (5v5 Tactical Shooter) and indoor athletic action (5-a-side Futsal). Rep your department squad and compete for the golden championship trophy and MVP awards!',
    category: 'Sports',
    venue: 'Indoor Sports Arena & Esports Hub Block',
    date: '2026-11-26T10:00:00.000Z',
    end_date: '2026-11-27T18:00:00.000Z',
    registration_deadline: '2026-11-23T23:59:59.000Z',
    status: 'published',
    registration_type: 'team',
    min_team_size: 3,
    max_team_size: 5,
    max_teams: 24,
    capacity: 120,
    allow_cross_department: true,
    team_leader_registration_required: true,
    join_team_enabled: true,
    image_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800',
    payment_enabled: false,
    scoring_enabled: true,
    scoreboard_visible: true,
    feedback_questions: defaultFeedbackQuestions
  },
  {
    title: 'Hands-on Drone Dynamics & ROS2 Robotics Bootcamp',
    description: 'Practical 2-day hands-on hardware workshop covering drone flight mechanics, custom PCB sensor integration, ROS2 control loops, and autonomous flight navigation with ESP32 & Pixhawk.',
    category: 'Workshop',
    venue: 'Robotics & Embedded Systems Lab, Block C',
    date: '2026-12-03T09:30:00.000Z',
    end_date: '2026-12-04T16:30:00.000Z',
    registration_deadline: '2026-11-30T23:59:59.000Z',
    status: 'published',
    registration_type: 'individual',
    capacity: 75,
    min_team_size: 1,
    max_team_size: 1,
    allow_cross_department: true,
    team_leader_registration_required: true,
    join_team_enabled: false,
    image_url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800',
    payment_enabled: false,
    scoring_enabled: false,
    scoreboard_visible: false,
    feedback_questions: defaultFeedbackQuestions
  },
  {
    title: 'Venture Horizon: Tech Startup Pitching & VC Masterclass',
    description: 'An exclusive interactive summit featuring prominent venture capitalists, successful student founders, and angel investors discussing startup valuation, fundraising dynamics, and pitch deck mastery.',
    category: 'Seminar',
    venue: 'Convention Center, Main Auditorium Hall A',
    date: '2026-12-10T14:00:00.000Z',
    end_date: '2026-12-10T18:00:00.000Z',
    registration_deadline: '2026-12-07T23:59:59.000Z',
    status: 'published',
    registration_type: 'individual',
    capacity: 200,
    min_team_size: 1,
    max_team_size: 1,
    allow_cross_department: true,
    team_leader_registration_required: true,
    join_team_enabled: false,
    image_url: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800',
    payment_enabled: false,
    scoring_enabled: false,
    scoreboard_visible: false,
    feedback_questions: defaultFeedbackQuestions
  }
];

async function seedEvents() {
  try {
    console.log('Fetching admin / organizer profile for event creation...');
    
    // Find an admin or first profile to assign as creator / publisher
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();

    const creatorId = adminProfile?.id || '00000000-0000-0000-0000-000000000001';
    console.log(`Using creator ID: ${creatorId} (${adminProfile?.email || 'System Default'})`);

    const nowIso = new Date().toISOString();
    const results = [];

    for (const eventData of eventsToCreate) {
      // Check if event with same title already exists
      const { data: existing } = await supabase
        .from('events')
        .select('id, title')
        .eq('title', eventData.title)
        .maybeSingle();

      const payload = {
        ...eventData,
        proposed_by: creatorId,
        created_by: creatorId,
        published_by: creatorId,
        published_at: nowIso,
        approved_at: nowIso,
        approval_remarks: 'Approved and published for demo.',
        registered_count: 0,
        attendance_count: 0,
        revision_number: 1,
        updated_at: nowIso
      };

      if (existing) {
        console.log(`Updating existing event: "${eventData.title}" (ID: ${existing.id})`);
        const { data: updated, error: updateError } = await supabase
          .from('events')
          .update(payload)
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) {
          console.error(`Error updating "${eventData.title}":`, updateError);
        } else {
          results.push(updated);
        }
      } else {
        console.log(`Inserting new event: "${eventData.title}"`);
        const { data: inserted, error: insertError } = await supabase
          .from('events')
          .insert({
            ...payload,
            created_at: nowIso
          })
          .select()
          .single();

        if (insertError) {
          console.error(`Error inserting "${eventData.title}":`, insertError);
        } else {
          results.push(inserted);
        }
      }
    }

    console.log(`\n Successfully published ${results.length} live events across 5 streams/categories!`);
    results.forEach((e, idx) => {
      console.log(`${idx + 1}. [${e.category}] ${e.title} (${e.registration_type} | Deadline: ${new Date(e.registration_deadline).toLocaleDateString()}) - ID: ${e.id}`);
    });

  } catch (err) {
    console.error('Fatal error in seedEvents:', err);
  } finally {
    process.exit(0);
  }
}

seedEvents();
