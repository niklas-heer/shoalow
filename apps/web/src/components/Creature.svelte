<script lang="ts">
  /**
   * Original Shoalow creature art, one per card value, drawn in a 100 × 100 box.
   * White shapes (.w) with dark details (.d fill, .ds stroke); .hole shows the card colour.
   */
  let { value }: { value: number } = $props();

  function star(cx: number, cy: number, outer: number, inner: number, points: number, rotate = -90): string {
    const out: string[] = [];
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = ((rotate + (i * 180) / points) * Math.PI) / 180;
      out.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
    }
    return out.join(" ");
  }

  const pufferSpikes = star(50, 52, 40, 29, 14);
  const lionSpines = Array.from({ length: 7 }, (_, i) => {
    const x = 30 + i * 7;
    const base = 46 - Math.sin((i / 6) * Math.PI) * 5;
    return { x1: x, y1: base, x2: x - 6 + i, y2: base - 22 + Math.abs(3 - i) * 3 };
  });
  const lionFan = Array.from({ length: 6 }, (_, i) => {
    const a = ((110 + i * 14) * Math.PI) / 180;
    return { x2: 52 + Math.cos(a) * 26, y2: 60 + Math.sin(a) * 26 };
  });
</script>

<g class="creature">
  {#if value === -2}
    <!-- pearl clam -->
    <path class="w ds" d="M12 52 C 20 14 80 14 88 52 Z" />
    <path class="ds thin" d="M50 22 L50 50 M32 26 L40 50 M68 26 L60 50 M20 38 L30 51 M80 38 L70 51" />
    <path class="w ds" d="M10 58 C 18 90 82 90 90 58 Z" />
    <path class="ds thin" d="M50 84 L50 62 M34 80 L40 62 M66 80 L60 62 M20 70 L30 61 M80 70 L70 61" />
    <circle class="pearl ds" cx="50" cy="56" r="13" />
    <circle class="w" cx="45" cy="51" r="3.5" />
  {:else if value === -1}
    <!-- conch -->
    <path class="w ds" d="M18 74 C 16 52 38 34 60 30 L 86 14 L 78 40 C 80 62 62 82 40 86 C 30 87 20 82 18 74 Z" />
    <path class="ds thin" d="M60 30 C 66 38 64 46 56 50 M70 24 C 74 30 72 36 68 38 M48 42 C 58 50 58 62 48 68" />
    <path class="hole ds" d="M24 72 C 30 60 44 60 48 70 C 44 80 30 82 24 72 Z" />
    <circle class="d" cx="66" cy="54" r="2.6" />
    <circle class="d" cx="74" cy="48" r="2.6" />
  {:else if value === 0}
    <!-- starfish -->
    <polygon class="w round" points={star(50, 54, 40, 17, 5)} />
    <circle class="d" cx="44" cy="50" r="3" />
    <circle class="d" cx="56" cy="50" r="3" />
    <path class="ds" d="M45 58 Q50 63 55 58" />
    <circle class="hole" cx="50" cy="26" r="2" />
    <circle class="hole" cx="76" cy="46" r="2" />
    <circle class="hole" cx="30" cy="78" r="2" />
    <circle class="hole" cx="70" cy="78" r="2" />
    <circle class="hole" cx="24" cy="46" r="2" />
  {:else if value === 1}
    <!-- krill -->
    <g transform="translate(16 18) scale(0.68)">
      <path class="body" d="M76 44 C 64 28 36 30 30 48 C 26 60 34 68 44 70" />
      <path class="w" d="M44 70 L 34 82 L 52 80 Z" />
      <path class="ds thin" d="M60 32 L 56 46 M48 32 L 46 46 M38 38 L 40 50 M32 50 L 42 54" />
      <path class="ws" d="M80 40 Q 92 26 98 12 M78 38 Q 84 22 82 8" />
      <path class="ws thin" d="M56 54 L 54 66 M48 56 L 44 66 M64 52 L 64 64" />
    </g>
    <circle class="d" cx="66" cy="44" r="4.5" />
    <circle class="w" cx="67.5" cy="42.5" r="1.4" />
  {:else if value === 2}
    <!-- shrimp -->
    <path class="body" d="M76 44 C 64 26 34 28 28 48 C 24 62 34 70 46 72" />
    <path class="w" d="M46 72 L 34 88 L 58 84 Z" />
    <path class="ds thin" d="M60 30 L 56 46 M48 30 L 46 46 M36 36 L 40 50 M29 52 L 42 55 M36 64 L 44 60" />
    <path class="ws" d="M80 40 Q 92 24 96 8 M78 38 Q 86 20 80 6" />
    <path class="ws thin" d="M58 56 L 58 68 M50 58 L 48 70 M66 54 L 68 66" />
    <circle class="d" cx="72" cy="42" r="3.5" />
  {:else if value === 3}
    <!-- seahorse -->
    <path class="ws fat" d="M54 36 C 42 46 48 58 58 62" />
    <path class="ws mid" d="M58 62 C 64 78 50 88 42 82 C 36 76 42 70 48 74" />
    <circle class="w" cx="56" cy="28" r="12" />
    <path class="ws snout" d="M62 30 L 80 34" />
    <path class="w" d="M44 22 L 48 10 L 52 18 L 56 8 L 58 18 Z" />
    <path class="w ds thin" d="M42 46 C 30 44 30 56 42 56 Z" />
    <path class="ds thin" d="M54 44 L 60 46 M54 52 L 61 53 M58 60 L 64 60" />
    <circle class="d" cx="58" cy="26" r="3" />
  {:else if value === 4}
    <!-- jellyfish -->
    <path class="ws tentacle" d="M30 56 q -5 10 0 18 q 5 8 0 16 M44 58 q 5 12 0 24 M56 58 q -5 12 0 24 M70 56 q 5 10 0 18 q -5 8 0 16" />
    <path class="w" d="M16 56 C 16 18 84 18 84 56 Q 76 62 67 56 Q 58 62 50 56 Q 42 62 33 56 Q 24 62 16 56 Z" />
    <circle class="d" cx="40" cy="42" r="3" />
    <circle class="d" cx="60" cy="42" r="3" />
    <path class="ds" d="M45 49 Q50 53 55 49" />
  {:else if value === 5}
    <!-- octopus -->
    <path class="ws arm" d="M34 58 C 24 70 12 68 14 80 M44 62 C 42 76 30 82 34 92 M56 62 C 58 76 70 82 66 92 M66 58 C 76 70 88 68 86 80" />
    <path class="w" d="M26 48 C 26 16 74 16 74 48 C 74 58 66 64 58 64 L 42 64 C 34 64 26 58 26 48 Z" />
    <circle class="d" cx="41" cy="44" r="3.4" />
    <circle class="d" cx="59" cy="44" r="3.4" />
    <path class="ds" d="M46 53 Q50 56 54 53" />
    <circle class="hole" cx="40" cy="28" r="2.5" />
    <circle class="hole" cx="54" cy="24" r="2" />
  {:else if value === 6}
    <!-- sea turtle -->
    <ellipse class="w" cx="36" cy="28" rx="13" ry="6" transform="rotate(-35 36 28)" />
    <ellipse class="w" cx="66" cy="28" rx="13" ry="6" transform="rotate(35 66 28)" />
    <ellipse class="w" cx="34" cy="76" rx="11" ry="5" transform="rotate(35 34 76)" />
    <ellipse class="w" cx="64" cy="76" rx="11" ry="5" transform="rotate(-35 64 76)" />
    <path class="w" d="M24 52 L 12 48 L 14 56 Z" />
    <circle class="w" cx="84" cy="50" r="9" />
    <circle class="d" cx="87" cy="47" r="2.2" />
    <ellipse class="w ds" cx="50" cy="52" rx="28" ry="22" />
    <polygon class="hole ds thin" points="50,42 59,47 59,57 50,62 41,57 41,47" />
    <path class="ds thin" d="M50 42 L 50 31 M59 47 L 72 41 M59 57 L 72 63 M50 62 L 50 73 M41 57 L 28 63 M41 47 L 28 41" />
  {:else if value === 7}
    <!-- crab -->
    <path class="ws mid" d="M28 60 L 16 44 M72 60 L 84 44" />
    <circle class="w" cx="14" cy="36" r="10" />
    <circle class="w" cx="86" cy="36" r="10" />
    <path class="hole" d="M14 36 L 4 26 L 14 24 Z M86 36 L 96 26 L 86 24 Z" />
    <path class="ws leg" d="M30 66 L 16 72 M32 70 L 20 82 M68 66 L 84 72 M68 70 L 80 82" />
    <path class="ws leg" d="M42 50 L 40 34 M58 50 L 60 34" />
    <circle class="w" cx="40" cy="31" r="5.5" />
    <circle class="w" cx="60" cy="31" r="5.5" />
    <circle class="d" cx="40" cy="31" r="2.5" />
    <circle class="d" cx="60" cy="31" r="2.5" />
    <ellipse class="w" cx="50" cy="60" rx="27" ry="16" />
    <path class="ds" d="M44 62 Q50 67 56 62" />
  {:else if value === 8}
    <!-- pufferfish -->
    <polygon class="w round" points={pufferSpikes} />
    <circle class="w" cx="50" cy="52" r="28" />
    <path class="w" d="M76 48 L 90 40 L 88 60 Z" />
    <circle class="d" cx="40" cy="46" r="3.6" />
    <circle class="d" cx="60" cy="46" r="3.6" />
    <ellipse class="d" cx="50" cy="61" rx="4" ry="3.2" />
    <path class="ds thin" d="M30 64 L 34 62 M70 64 L 66 62" />
  {:else if value === 9}
    <!-- lionfish -->
    {#each lionSpines as s}
      <line class="ws thin" x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
    {/each}
    {#each lionFan as f}
      <line class="ws thin" x1="52" y1="60" x2={f.x2} y2={f.y2} />
    {/each}
    <path class="w" d="M22 54 L 8 42 L 10 66 Z" />
    <path class="w" d="M20 54 C 34 38 66 38 84 54 C 66 68 34 70 20 54 Z" />
    <path class="ds stripe" d="M34 45 L 32 63 M44 42 L 42 66 M54 42 L 54 66 M64 45 L 65 63" />
    <circle class="d" cx="74" cy="51" r="3" />
    <path class="ds thin" d="M80 58 L 86 57" />
  {:else if value === 10}
    <!-- moray eel -->
    <path class="ws eel" d="M8 84 C 26 62 38 92 56 72 C 66 60 64 44 72 36" />
    <path class="w" d="M64 40 C 64 26 80 18 92 24 L 92 34 L 78 36 L 90 42 C 86 50 70 52 64 40 Z" />
    <path class="d" d="M78 36 L 92 34 L 90 42 Z" />
    <path class="ds thin" d="M80 35 L 81 38 M84 35 L 85 38.5" />
    <circle class="d" cx="80" cy="27" r="2.6" />
    <path class="ds" d="M75 22 L 84 24" />
  {:else if value === 11}
    <!-- shark -->
    <path class="w" d="M44 46 L 54 22 L 62 46 Z" />
    <path class="w" d="M16 56 L 4 36 L 10 56 L 4 74 Z" />
    <path class="w" d="M8 56 C 24 42 54 38 76 45 C 84 48 92 52 96 56 C 90 61 82 63 74 63 C 54 67 26 65 8 56 Z" />
    <path class="w ds thin" d="M50 62 L 44 76 L 60 63" />
    <path class="ds thin" d="M66 50 L 64 58 M70 50 L 68 58" />
    <circle class="d" cx="82" cy="52" r="2.6" />
    <path class="ds thin" d="M76 59 L 79 61.5 L 82 59 L 85 61.5 L 88 59" />
  {:else if value === 12}
    <!-- grumpy anglerfish -->
    <path class="ws lure" d="M40 38 Q 36 16 20 16" />
    <circle class="halo" cx="18" cy="17" r="11" />
    <circle class="glow" cx="18" cy="17" r="6" />
    <path class="w" d="M78 60 L 96 46 L 94 76 Z" />
    <path class="w" d="M16 62 C 16 40 40 34 58 38 C 76 42 84 52 82 64 C 80 78 60 86 42 84 C 26 82 16 74 16 62 Z" />
    <path class="d" d="M16 64 C 26 60 40 62 52 70 C 42 80 24 78 16 70 Z" />
    <path class="w" d="M20 64 L 23 70 L 26 63.5 L 30 70 L 33 63.6 L 37 70.5 L 40 64.5 L 44 71 L 47 67 Z" />
    <circle class="d" cx="42" cy="50" r="4" />
    <path class="ds brow" d="M34 42 L 50 47" />
    <path class="ds thin" d="M60 48 L 66 56 M66 46 L 72 54" />
  {/if}
</g>

<style>
  .creature {
    --line: var(--card-ink, #10202a);
  }
  .w {
    fill: var(--creature, #fffdf7);
  }
  .d {
    fill: var(--line);
  }
  .hole {
    fill: var(--card-fill);
  }
  .pearl {
    fill: #f7f1ff;
  }
  .ds {
    stroke: var(--line);
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .ds:not(.w):not(.hole):not(.pearl) {
    fill: none;
  }
  .thin {
    stroke-width: 1.6;
  }
  .ws {
    fill: none;
    stroke: var(--creature, #fffdf7);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .ws.thin {
    stroke-width: 2;
  }
  .body {
    fill: none;
    stroke: var(--creature, #fffdf7);
    stroke-width: 15;
    stroke-linecap: round;
  }
  .fat {
    stroke-width: 15;
  }
  .mid {
    stroke-width: 7;
  }
  .snout {
    stroke-width: 7;
  }
  .leg {
    stroke-width: 3.5;
  }
  .arm {
    stroke-width: 8;
  }
  .tentacle {
    stroke-width: 4;
  }
  .eel {
    stroke-width: 15;
  }
  .lure {
    stroke-width: 2.5;
  }
  .stripe {
    stroke-width: 3;
    opacity: 0.55;
  }
  .brow {
    stroke-width: 3.4;
  }
  .round {
    stroke: var(--creature, #fffdf7);
    stroke-width: 6;
    stroke-linejoin: round;
  }
  .glow {
    fill: var(--lantern, #ffe27a);
  }
  .halo {
    fill: var(--lantern, #ffe27a);
    opacity: 0.35;
  }
</style>
