interface TimelineItem {
  date: string;
  title: string;
  description: string;
  highlight: boolean;
}

interface WordPressEvent {
  id: number;
  slug: string;
  title: { rendered: string };
  content: { rendered: string };
  meta?: {
    timeline_event_date?: string;
    timeline_event_highlight?: string | boolean;
  };
}

export async function getTimelineEvents(): Promise<TimelineItem[]> {
  try {
    const response = await fetch(
      "https://yem.yenamarre.sn/yenamarre/wp-json/wp/v2/timeline_event?per_page=100&_embed=true",
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const events: WordPressEvent[] = await response.json();


    const timelineItems: TimelineItem[] = events.map((event) => ({
      date: event.meta?.timeline_event_date || "",
      title: event.title.rendered
        .replace(/<\/?[^>]+(>|$)/g, "")
        .replace(/&#39;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&lsquo;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&"),
      description: event.content.rendered
        .replace(/<\/?[^>]+(>|$)/g, "")
        .replace(/&#39;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&lsquo;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&"),
      highlight:
        event.meta?.timeline_event_highlight === "1" ||
        event.meta?.timeline_event_highlight === true,
    }));

    // Trier les événements par date (format "JJ Mois AAAA")
    const sortedItems = timelineItems
      .filter((item) => item.date) // Exclure les événements sans date
      .sort((a, b) => {
        const months = [
          "Janvier",
          "Février",
          "Mars",
          "Avril",
          "Mai",
          "Juin",
          "Juillet",
          "Août",
          "Septembre",
          "Octobre",
          "Novembre",
          "Décembre",
        ];

        const parseDate = (dateStr: string): Date => {
          const parts = dateStr.trim().split(" ");
          
          // Si c'est juste une année (ex: "2011")
          if (parts.length === 1 && /^\d{4}$/.test(parts[0])) {
            return new Date(`${parts[0]}-01-01`);
          }
          
          // Si c'est mois et année (ex: "Juin 2011" ou "Juin-Juillet 2011")
          if (parts.length === 2) {
            const [monthPart, year] = parts;
            
            // Gérer les intervalles de mois (ex: "Juin-Juillet")
            if (monthPart.includes("-")) {
              const firstMonth = monthPart.split("-")[0];
              const monthIndex = months.indexOf(firstMonth);
              return new Date(`${year}-${monthIndex + 1}-01`);
            } else {
              const monthIndex = months.indexOf(monthPart);
              return new Date(`${year}-${monthIndex + 1}-01`);
            }
          }
          
          // Si c'est jour(s) mois année (ex: "18 Janvier 2011" ou "22-23 Juin 2011")
          if (parts.length === 3) {
            const [dayPart, month, year] = parts;
            const monthIndex = months.indexOf(month);
            
            // Gérer les plages de dates (ex: "22-23")
            const day = dayPart.includes("-") ? dayPart.split("-")[0] : dayPart;
            
            return new Date(`${year}-${monthIndex + 1}-${day.padStart(2, "0")}`);
          }
          
          // Format de fallback
          return new Date("1970-01-01");
        };

        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        return dateA.getTime() - dateB.getTime();
      });

    return sortedItems;
  } catch (error) {
    console.error("Error fetching timeline events:", error);
    return [];
  }
}
