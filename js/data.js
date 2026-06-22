// ============================================================================
//  data.js — verbatim content (§7) for the cab modals.
// ============================================================================

export const BASKETBALL = {
  kicker: 'BASKETBALL JOURNEY',
  title: 'The game is never truly over',
  blocks: [
    { icon: 'trophy', label: 'Milestones', items: [
      '2× MVP (2015, 2016)',
      'Premier League Champion (2020)',
      'Best Defensive Player (2025)',
    ] },
    { icon: 'flag', label: 'National Team', items: [
      'Bangladesh U18 (2014)',
      'Bangladesh U18 (2016)',
      'Bangladesh U23 3x3 (2018)',
    ] },
    { icon: 'ball', label: 'Memorable Games', items: [
      'NDC vs. St. Joseph Higher Secondary School — SIBT 2015',
      'Bangladesh vs. Sri Lanka — 2016',
    ] },
    { icon: 'quote', label: 'What Basketball Taught Me', text:
      'Basketball has been one of the defining forces in my life. It taught me that consistency and disciplined effort matter more than talent alone. Through victories, setbacks, and recovering from ACL and meniscus injuries, the game built resilience, mental toughness, and a commitment to keep moving forward.' },
  ],
};

// §7 — Creative Origins: 5 projects (detail = challenge / tools / Behance links).
export const CREATIVE = {
  accent: 'ember',
  nameplate: 'CREATIVE ORIGINS',
  projects: [
    {
      brand: 'One Percent Basketball', title: 'Comprehensive Identity & Web Design',
      meta: 'BRAND · IDENTITY & WEB',
      challenge: 'Creating a premium brand identity and web concept for a basketball training startup offering facilities, coaching, and a custom gear line.',
      tools: ['Figma', 'Blender', 'Photoshop'],
      links: [
        { label: 'Brand Identity', url: 'https://www.behance.net/gallery/136472045/One-Percent-Basketball-Brand-Identity' },
        { label: 'Website Concept', url: 'https://www.behance.net/gallery/136499733/1Percent-Website-Design-Concept' },
      ],
    },
    {
      brand: 'Saleha Metal Industries', title: 'Industrial Corporate Rebranding',
      meta: 'BRAND · LOGO & IDENTITY',
      challenge: "Modernizing an established manufacturer's legacy and vision into a single, high-impact logo.",
      tools: ['Figma', 'Photoshop'],
      links: [{ label: 'View Case Study', url: 'https://www.behance.net/gallery/136465367/Saleha-Metal-Industries-Brand-Identity' }],
    },
    {
      brand: 'Favour Bank', title: 'Symbolic Visual Identity',
      meta: 'BRAND · IDENTITY',
      challenge: "Distilling a community organization's collective mission and core values into a unified brand mark.",
      tools: ['Figma', 'Illustrator', 'Photoshop'],
      links: [{ label: 'View Case Study', url: 'https://www.behance.net/gallery/136451219/Favour-Bank-Brand-Identity' }],
    },
    {
      brand: 'Haval', title: 'Digital Marketing & Social Campaign Concept',
      meta: 'CAMPAIGN · SOCIAL',
      challenge: "Engineering high-impact visual solutions to elevate the brand's social media marketing presence.",
      tools: ['Figma', 'Illustrator', 'Photoshop'],
      links: [{ label: 'View Case Study', url: 'https://www.behance.net/gallery/121028921/Haval-Social-Media-Marketing-Concept' }],
    },
    {
      brand: 'Cornucopia', title: 'Culinary Brand Identity & Launch',
      meta: 'BRAND · IDENTITY & LAUNCH',
      challenge: 'Building a distinct visual identity, custom illustrations, and digital footprint from scratch for a new eatery.',
      tools: ['Figma', 'Illustrator', 'Photoshop', 'Procreate'],
      links: [{ label: 'View Case Study', url: 'https://www.behance.net/gallery/120529627/Cornucopia-Restaurant-Branding' }],
    },
  ],
};

// §7 — Unilever Station: 4 cases (detail = Challenge / Approach / Impact / Tools / Key Learning).
export const UNILEVER = {
  accent: 'steel',
  nameplate: 'UNILEVER STATION',
  projects: [
    {
      brand: 'Project Pigeon', title: 'Automated Retailer Communication', meta: 'PILLAR: ANALYTICS & AUTOMATION',
      challenge: 'During periods of political disruption and national elections, market servicing became inconsistent and retailer communication heavily depended on field sales teams, creating gaps in communicating loyalty updates, payouts, and trade offers.',
      approach: 'Built an automated retailer communication system integrating the DMS with the Pushbullet API, delivering personalized SMS at scale with real-time loyalty/payout/offer visibility.',
      impact: '~9% increase in loyalty program depth · ~13% increase in width · significant order-volume uplift · eliminated manual communication · enabled engagement during unserviceable conditions.',
      tools: ['Excel VBA', 'Automation Workflows', 'Pushbullet API', 'Access Tokens', 'DMS Integration'],
      learning: 'Technology can solve distribution challenges more effectively than added manpower; scalable communication builds trust, consistency, and commercial impact.',
    },
    {
      brand: 'Town Mirror', title: 'BI Performance Dashboard', meta: 'PILLAR: ANALYTICS & AUTOMATION',
      challenge: "After Unilever's move to Business-Unit-specific sales structures, management visibility fragmented; no single source of truth to monitor performance and intervene early.",
      approach: 'Built a BI dashboard consolidating BU performance, sales-officer productivity, route performance, loyalty execution, and distribution KPIs, with a flag-based framework auto-highlighting underperformance vs. time elapsed and potential.',
      impact: 'reporting accumulation time −67% · business visibility ×3 · instant identification of weak BUs/officers/routes · faster decisions & field intervention · complete snapshot via one interface.',
      tools: ['Power Query', 'DAX', 'Excel Data Modelling', 'KPI Framework Design', 'Performance Analytics'],
      learning: "Analytics' value is revealing where action is needed before performance deteriorates, not just reporting the past.",
    },
    {
      brand: 'Dhaka EPZ Bifurcation & RTM Design', title: 'Route-to-Market Design', meta: 'PILLAR: DISTRIBUTION & RTM STRATEGY',
      challenge: 'Design a new Route-to-Market model by dissolving Dhamrai into Dhaka EPZ, reducing dependence on garment billing cycles, ensuring geographic diversification, maximizing coverage, and keeping distributor returns attractive.',
      approach: 'Created a new 9 Cr/month Dhaka EPZ territory via bifurcation and restructuring of five adjacent towns; evaluated RTM scenarios with Cost-to-Serve, Distributor ROI, outlet-universe mapping, and route optimization; redesigned the sales structure from both legacy territories.',
      impact: 'launched a balanced 9 Cr/month territory · 18%+ first-year ROI · record 11.34 Cr in March 2025 · 6.1% YoY growth · diversified, sustainable base · improved coverage at low Cost-to-Serve.',
      tools: ['Cost-to-Serve Analysis', 'Route Geolocation Matrix', 'Market Assessment', 'Outlet Universe Mapping', 'Distributor ROI Model', 'RTM Design Framework', 'Network Optimization'],
      learning: 'The strongest networks are built for profitable coverage, sustainable growth, and operational resilience — not maximum coverage.',
    },
    {
      brand: 'Rin Execution Challenge', title: '360° Market Execution Campaign', meta: 'PILLAR: BRAND & COMMERCIAL EXECUTION',
      challenge: 'Develop a market-execution campaign for the Rin relaunch to maximize visibility, strengthen recall, and create meaningful engagement in the territory.',
      approach: 'A localized 360° campaign on one insight — during Durga Puja, consumers want to celebrate without worrying about stains — integrating retail visibility, festival branding, community touchpoints, outdoor, branded tea stalls, backlit displays, signage, and Puja Mandap activations under one message linking celebration with Rin’s cleaning power.',
      impact: 'significantly higher top-of-mind awareness · strong organic engagement & sharing · high visibility across touchpoints · 2nd place nationally in the Rin Execution Challenge.',
      tools: ['360° Campaign Design', 'Trade Marketing', 'BTL Activation', 'Retail Visibility', 'Shopper Marketing', 'POSM', 'Outdoor Branding', 'Experiential Marketing', 'Consumer Insight Mapping'],
      learning: 'The best campaigns are built around local cultural moments and consumer behavior, so the brand becomes part of the experience rather than advertising around it.',
    },
  ],
};

export const BIO = {
  kicker: 'ALL ABOARD',
  title: 'Who is Poonno?',
  paragraphs: [
    "If you're looking for a neat, one-line description, I'm afraid you've boarded the wrong train.",
    "Hi, I'm Poonno.",
    "Over the years, I've been a creative director, a brand builder, a spreadsheet enthusiast (yes, they exist), a data nerd, a problem solver, and a basketball player playing at the highest level as part of the Bangladesh National Team who still refuses to believe the game is ever truly over.",
    "Most people pick a track and stay on it. I got curious and explored a few.",
    "The first station takes you through my creative roots—where ideas, storytelling, and late-night brainstorming sessions became real projects. The second station explores my journey through Unilever, where I learned how products move, brands grow, and data tells stories that creativity alone cannot.",
    "And then comes the final station. The interesting thing is... it hasn't been built yet.",
    "Maybe it's a startup. Maybe it's a new business challenge. Maybe it's a team trying to solve a problem worth solving. Maybe it's you!",
    "What I do know is what I'll bring when I get there: the creativity to imagine, the commercial understanding to execute, the analytical mindset to measure, and the resilience to keep moving when things get tough. As basketball has always been the engine pulling me forward.",
    "So take a look around. If our paths happen to cross at the next station, perhaps we'll build it together. All aboard.",
  ],
};
