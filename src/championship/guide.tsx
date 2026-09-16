/** Original control diagrams: the moving parts are repeated by the touch UI. */
export function ChampionshipGuide({
  event,
}: {
  event: "race" | "fight" | "cup";
}) {
  return (
    <svg className="lesson-picture" viewBox="0 0 240 78" aria-hidden="true">
      {event === "race" ? (
        <>
          <path d="M16 62H224 M46 15L32 58 M194 15L208 58" />
          <path d="M55 48Q113 -10 179 43" strokeDasharray="4 5" />
          <path d="M166 40L180 44L177 30 M53 63V49H81V63" />
          <rect x="106" y="42" width="30" height="20" rx="3" />
          <path
            d="M111 45V59 M131 45V59 M106 49H136 M106 56H136"
            opacity=".4"
          />
          <path d="M40 29H76 M46 23L40 29L46 35 M70 23L76 29L70 35" />
          <text x="142" y="72">
            JUMP THE HURDLE
          </text>
        </>
      ) : event === "fight" ? (
        <>
          <circle cx="63" cy="21" r="8" />
          <circle cx="171" cy="21" r="8" />
          <path d="M63 29V49L48 64 M63 49L78 64 M63 35L91 31 M171 29V49L156 64 M171 49L186 64 M171 35L153 31" />
          <path d="M137 20L151 25V39Q150 48 137 54Q124 48 123 39V25Z" />
          <path d="M94 35H111 M103 29L111 35L103 41" />
          <text x="121" y="73">
            READ · GUARD · REPLY
          </text>
        </>
      ) : (
        <>
          <path d="M101 14H139L136 35Q132 47 120 47Q108 47 104 35Z M120 47V58 M108 58H132V65H108Z M101 21H90V29Q91 39 105 39 M139 21H150V29Q149 39 135 39" />
          <text className="guide-score" x="46" y="35">
            50
          </text>
          <text className="guide-score" x="195" y="35">
            50
          </text>
          <text x="46" y="52">
            RACE
          </text>
          <text x="195" y="52">
            DUEL
          </text>
          <path d="M74 33H91 M149 33H166" strokeDasharray="3 3" />
        </>
      )}
    </svg>
  );
}
