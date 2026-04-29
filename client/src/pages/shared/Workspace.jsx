import Layout from '../../components/shared/Layout'
import useAuthStore from '../../store/authStore'

const workspaceByRole = {
  teacher: {
    badge: 'Teacher workspace',
    title: 'Integration with Modern Tools',
    summary: 'Launch live classes, parent meetings, and shared study spaces from one board.',
    cards: [
      {
        name: 'Google Classroom',
        href: 'https://classroom.google.com',
        action: 'Open Classroom',
        accent: 'bg-[#6fa8ff]',
        detail: 'Publish announcements, assignments, and class materials for students in one place.',
      },
      {
        name: 'Microsoft Teams',
        href: 'https://teams.microsoft.com',
        action: 'Start Teams',
        accent: 'bg-[#97e675]',
        detail: 'Run teacher-student-parent meetings and keep discussion threads grouped by class.',
      },
      {
        name: 'Zoom',
        href: 'https://zoom.us/meeting/schedule',
        action: 'Schedule Zoom',
        accent: 'bg-[#ffd84d]',
        detail: 'Arrange live revision sessions, PTMs, and focused class calls with invite-ready links.',
      },
      {
        name: 'Discord',
        href: 'https://discord.com/app',
        action: 'Open Discord',
        accent: 'bg-[#ff8db3]',
        detail: 'Create student study rooms, topic channels, and after-class collaboration spaces.',
      },
    ],
    highlights: [
      'Use Teams or Zoom for teacher-led meetings with students and parents.',
      'Use Google Classroom to distribute classwork before and after live sessions.',
      'Use Discord for student-to-student interaction and combined study groups.',
    ],
  },
  parent: {
    badge: 'Parent workspace',
    title: 'Connected Family Coordination',
    summary: 'Jump into the same meeting platforms your teacher uses without searching through separate tabs.',
    cards: [
      {
        name: 'Microsoft Teams',
        href: 'https://teams.microsoft.com',
        action: 'Join Teams',
        accent: 'bg-[#97e675]',
        detail: 'Use for parent-teacher meetings, follow-up calls, and progress check-ins.',
      },
      {
        name: 'Zoom',
        href: 'https://zoom.us/join',
        action: 'Join Zoom',
        accent: 'bg-[#ffd84d]',
        detail: 'Join scheduled academic review meetings and direct conversations with teachers.',
      },
      {
        name: 'Google Classroom',
        href: 'https://classroom.google.com',
        action: 'Open Classroom',
        accent: 'bg-[#6fa8ff]',
        detail: 'Review class context and shared materials when the teacher organizes work in Classroom.',
      },
    ],
    highlights: [
      'Teams and Zoom are best for structured meetings with teachers.',
      'Classroom helps you follow course context and assignment timelines.',
    ],
  },
  student: {
    badge: 'Student workspace',
    title: 'Study Tools and Collaboration',
    summary: 'Move between class platforms, live sessions, and peer study spaces from one workspace.',
    cards: [
      {
        name: 'Google Classroom',
        href: 'https://classroom.google.com',
        action: 'Open Classroom',
        accent: 'bg-[#6fa8ff]',
        detail: 'Track class announcements, files, and assignments shared by your teacher.',
      },
      {
        name: 'Microsoft Teams',
        href: 'https://teams.microsoft.com',
        action: 'Open Teams',
        accent: 'bg-[#97e675]',
        detail: 'Join scheduled classes, review calls, and teacher check-ins with parents when needed.',
      },
      {
        name: 'Zoom',
        href: 'https://zoom.us/join',
        action: 'Join Zoom',
        accent: 'bg-[#ffd84d]',
        detail: 'Attend revision meetings, office hours, and focused exam prep sessions.',
      },
      {
        name: 'Discord',
        href: 'https://discord.com/app',
        action: 'Open Discord',
        accent: 'bg-[#ff8db3]',
        detail: 'Use group channels for combined studies, doubt-solving, and student-to-student interaction.',
      },
    ],
    highlights: [
      'Discord is the best fit here for student-to-student interaction.',
      'Teams and Zoom support teacher-arranged meetings.',
      'Classroom keeps assignments and materials tied to the class.',
    ],
  },
}

export default function WorkspacePage() {
  const { user } = useAuthStore()
  const content = workspaceByRole[user?.role] || workspaceByRole.student

  return (
    <Layout>
      <div className="space-y-6">
        <section className="retro-shell overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[1.15fr,0.85fr]">
            <div className="border-b-[3px] border-black bg-[#fff8e8] p-6 lg:border-b-0 lg:border-r-[3px]">
              <div className="retro-chip bg-[#d9e9ff]">{content.badge}</div>
              <h1 className="retro-title mt-4 text-4xl sm:text-5xl">{content.title}</h1>
              <p className="mt-4 max-w-2xl text-base font-medium text-black/75">{content.summary}</p>
            </div>
            <div className="bg-[#111111] p-6 text-white">
              <p className="retro-mono text-xs uppercase tracking-[0.2em] text-white/70">Recommended flow</p>
              <div className="mt-4 space-y-3">
                {content.highlights.map((item) => (
                  <div key={item} className="rounded-[20px] border-[3px] border-white/90 bg-white/10 px-4 py-4 shadow-[4px_4px_0_rgba(255,255,255,0.22)]">
                    <p className="text-sm font-bold text-white">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {content.cards.map((card) => (
            <article key={card.name} className={`retro-panel flex h-full flex-col p-6 ${card.accent}`}>
              <p className="retro-chip bg-white">{card.name}</p>
              <p className="mt-4 text-xl font-black text-black">{card.detail}</p>
              <a
                href={card.href}
                target="_blank"
                rel="noreferrer"
                className="retro-button mt-6 inline-flex w-fit bg-white px-4 py-2 text-black"
              >
                {card.action}
              </a>
            </article>
          ))}
        </section>
      </div>
    </Layout>
  )
}
