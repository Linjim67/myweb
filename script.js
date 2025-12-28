// PART 1: The Filter Buttons Logic
document.addEventListener('DOMContentLoaded', () => {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const cards = document.querySelectorAll('.subject-card');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove 'active' class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add 'active' class to clicked button
            button.classList.add('active');

            const filterValue = button.getAttribute('data-filter');

            // Show/Hide cards
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

// PART 2: The Particle Background Logic
// We wrap this in an async function to load the library settings
(async () => {
  await tsParticles.load("tsparticles", {
    particles: {
      color: { value: "#888888" }, // Dot color
      links: {
        enable: true,
        color: "#888888", // Line color
        distance: 150,
        opacity: 0.5,
        width: 1,
      },
      move: {
        enable: true,
        speed: 1, // "Swimming" speed
      },
      number: {
        value: 80, // Number of dots
        density: { enable: true, area: 800 },
      },
      opacity: { value: 0.5 },
      size: { value: { min: 1, max: 3 } },
    },
    interactivity: {
      events: {
        onHover: {
          enable: true,
          mode: "grab", // Creates lines to your mouse
        },
        onClick: {
          enable: true,
          mode: "push", // Adds more dots on click
        },
      },
      modes: {
        grab: {
          distance: 140,
          links: { opacity: 1 },
        },
      },
    },
  });
})();