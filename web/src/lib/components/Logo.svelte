<script lang="ts">
  // La goutte (la pompe) et l'éclair (la prise) : le sujet du site en une marque.
  let { size = 38 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
  <rect width="40" height="40" rx="12" fill="#2a78d6" />
  <path d="M20 7c0 0-9 10.2-9 16.4a9 9 0 0 0 18 0C29 17.2 20 7 20 7z" fill="#ffffff" />
  <path d="M21.6 15.5l-5.2 8.1h3.6l-1.6 6.9 5.4-8.4h-3.7z" fill="#2a78d6" />
</svg>
