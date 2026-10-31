// The story campaigns, as planned in docs/CAMPAIGN.md. None is playable yet: the Story tab lists them
// as coming soon. Teasers are player-facing, so keep them spoiler-light.

export interface MissionInfo {
  title: string;
  teaser: string;
}

export interface CampaignInfo {
  id: string;
  faction: string; // a FACTIONS id
  title: string;
  tagline: string;
  missions: MissionInfo[]; // empty until the campaign is outlined for players
}

export const CAMPAIGNS: CampaignInfo[] = [
  {
    id: "wardens",
    faction: "warden",
    title: "The Drill Book",
    tagline: "A new Marshal, a four-hundred-year-old book of formations, and a goblin Boss with a season's worth of grievances.",
    missions: [
      { title: "Hands Off", teaser: "A goat has wandered across the border at Millbrook. Settle it on the Field." },
      { title: "The Appeal", teaser: "The goblins appeal the goat. Under the Compact, an appeal is a longer match." },
      { title: "Two Keeps", teaser: "Someone has painted something rude on the West Keep." },
      { title: "Under the Bridge", teaser: "The goblins have adopted the troll under the toll bridge. And its toll." },
      { title: "Plain Steel", teaser: "A goblin Tinker accuses the Wardens of stealing the wheelbarrow." },
      { title: "Look Up", teaser: "The Compact draws borders on the ground. The goblins have noticed." },
      { title: "Old Grumm", teaser: "Thirty years ago, an ogre ate the Sergeant's helmet." },
      { title: "The Marches", teaser: "The season final. The Boss stakes the whole border." },
    ],
  },
  {
    id: "goblins",
    faction: "greenskin",
    title: "The Tinker's Odds",
    tagline: "“Lads, they had pointy sticks and we had nothing. So I made a bigger thing.”",
    missions: [],
  },
  {
    id: "elementals",
    faction: "elemental",
    title: "We Burn",
    tagline: "“We are not complicated because we are clever. We are complicated because we burn.”",
    missions: [],
  },
];
