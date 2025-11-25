document.addEventListener('DOMContentLoaded', () => {
    const rows = document.querySelectorAll('.row-wrapper');

    rows.forEach(row => {
        const container = row.querySelector('.row-scroll-container');
        const leftBtn = row.querySelector('.scroll-btn.left');
        const rightBtn = row.querySelector('.scroll-btn.right');

        if (!container) return;

        // Drag state
        let isDown = false;
        let startX;
        let scrollLeft;
        let hasMoved = false;

        // Update UI function
        const updateUI = () => {
            const isAtStart = container.scrollLeft <= 0;
            // Use a small tolerance for float/rounding issues
            const isAtEnd = Math.abs(container.scrollWidth - container.clientWidth - container.scrollLeft) < 2;
            const hasOverflow = container.scrollWidth > container.clientWidth;

            // Handle buttons
            if (leftBtn) {
                if (isAtStart) leftBtn.classList.add('hidden');
                else leftBtn.classList.remove('hidden');
            }

            if (rightBtn) {
                if (isAtEnd || !hasOverflow) rightBtn.classList.add('hidden');
                else rightBtn.classList.remove('hidden');
            }

            // Handle fade mask
            if (!hasOverflow) {
                container.style.maskImage = 'none';
                container.style.webkitMaskImage = 'none';
            } else if (isAtStart) {
                // Fade only on right
                container.style.maskImage = 'linear-gradient(to right, black 0%, black calc(100% - 60px), transparent 100%)';
                container.style.webkitMaskImage = 'linear-gradient(to right, black 0%, black calc(100% - 60px), transparent 100%)';
            } else if (isAtEnd) {
                // Fade only on left
                container.style.maskImage = 'linear-gradient(to right, transparent 0%, black 60px, black 100%)';
                container.style.webkitMaskImage = 'linear-gradient(to right, transparent 0%, black 60px, black 100%)';
            } else {
                // Fade on both sides
                container.style.maskImage = 'linear-gradient(to right, transparent 0%, black 60px, black calc(100% - 60px), transparent 100%)';
                container.style.webkitMaskImage = 'linear-gradient(to right, transparent 0%, black 60px, black calc(100% - 60px), transparent 100%)';
            }
        };

        // Initial update
        updateUI();
        // Also update on window load to ensure layout is complete (images loaded etc)
        window.addEventListener('load', updateUI);

        // Listeners
        container.addEventListener('scroll', updateUI);
        window.addEventListener('resize', updateUI);

        // Drag functionality
        container.addEventListener('mousedown', (e) => {
            isDown = true;
            hasMoved = false;
            container.classList.add('active');
            startX = e.pageX - container.offsetLeft;
            scrollLeft = container.scrollLeft;
        });

        container.addEventListener('mouseleave', () => {
            isDown = false;
            container.classList.remove('active');
        });

        container.addEventListener('mouseup', () => {
            isDown = false;
            container.classList.remove('active');
        });

        container.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            
            const x = e.pageX - container.offsetLeft;
            const walk = (x - startX) * 1; // Scroll speed multiplier (1:1 movement)
            
            // Only consider it a move if we moved more than 5 pixels
            if (Math.abs(walk) > 5) {
                hasMoved = true;
                e.preventDefault();
                container.scrollLeft = scrollLeft - walk;
            }
        });

        // Prevent clicks if we dragged
        // We need to attach this to the links inside the container, not the container itself
        // because the click event originates from the link
        const links = container.querySelectorAll('a');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                if (hasMoved) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
            
            // Also prevent default drag behavior on images to avoid ghost images
            const img = link.querySelector('img');
            if (img) {
                img.addEventListener('dragstart', (e) => e.preventDefault());
            }
        });
    });
});