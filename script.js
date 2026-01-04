document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup Filters
    const filterButtons = document.querySelectorAll('.filter-btn');
    const cards = document.querySelectorAll('.subject-card');

    // Define colors to match your CSS (Summer=Orange, Winter=Blue, Mock=Green)
    const categoryColors = {
        all: '#576574',       // Dark Grey for "All"
        summer: '#FF9F43',    // Orange
        winter: '#54a0ff',    // Blue
        mock: '#1dd1a1'       // Green
    };

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Reset all buttons
            filterButtons.forEach(btn => {
                btn.classList.remove('active');
                btn.style.backgroundColor = '#e0e0e0';
            });

            // Activate clicked button
            button.classList.add('active');
            const filterValue = button.getAttribute('data-filter');
            
            // Apply Color
            button.style.backgroundColor = categoryColors[filterValue] || '#333';

            // Filter Cards
            cards.forEach(card => {
                if (filterValue === 'all' || card.getAttribute('data-category') === filterValue) {
                    card.classList.remove('hide');
                } else {
                    card.classList.add('hide');
                }
            });
        });
    });
});

// 2. Setup Particles (Background)
(async () => {
  await tsParticles.load("tsparticles", {
    particles: {
      color: { value: "#888888" },
      links: {
        enable: true,
        color: "#888888",
        distance: 150,
        opacity: 0.5,
        width: 1,
      },
      move: { enable: true, speed: 1.5 },
      number: { value: 100, density: { enable: true, area: 800 } },
      opacity: { value: 0.5 },
      size: { value: { min: 1, max: 3 } },
    },
    interactivity: {
      events: {
        onHover: { enable: true, mode: "grab" },
        onClick: { enable: true, mode: "push" },
      },
      modes: {
        grab: { distance: 140, links: { opacity: 1 } },
      },
    },
  });
})();