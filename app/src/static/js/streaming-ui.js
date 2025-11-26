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
        let velX = 0;
        let momentumID;
        let lastPageX;
        let lastTime;

        const beginMomentum = () => {
            cancelAnimationFrame(momentumID);
            container.style.scrollBehavior = 'auto';
            
            const momentumLoop = () => {
                container.scrollLeft -= velX;
                velX *= 0.95; // Friction
                
                if (Math.abs(velX) < 0.5) {
                    container.style.scrollBehavior = '';
                    return;
                }
                
                momentumID = requestAnimationFrame(momentumLoop);
            };
            
            momentumLoop();
        };

        container.addEventListener('mousedown', (e) => {
            isDown = true;
            hasMoved = false;
            container.classList.add('active');
            startX = e.pageX - container.offsetLeft;
            scrollLeft = container.scrollLeft;
            
            // Reset momentum
            cancelAnimationFrame(momentumID);
            container.style.scrollBehavior = '';
            velX = 0;
            lastPageX = e.pageX;
            lastTime = Date.now();
        });

        // Stop momentum on wheel scroll to prevent fighting
        container.addEventListener('wheel', () => {
            cancelAnimationFrame(momentumID);
            container.style.scrollBehavior = '';
        });

        const stopDragging = () => {
            isDown = false;
            container.classList.remove('active');
            
            // If user stopped moving before releasing (e.g. hold for 50ms), kill momentum
            if (Date.now() - lastTime > 50) {
                velX = 0;
            }
            
            if (hasMoved && Math.abs(velX) > 1) {
                beginMomentum();
            }
        };

        container.addEventListener('mouseleave', stopDragging);
        container.addEventListener('mouseup', stopDragging);

        container.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            
            const x = e.pageX - container.offsetLeft;
            const walk = (x - startX) * 1; // Scroll speed multiplier (1:1 movement)
            
            // Calculate velocity
            const now = Date.now();
            const dt = now - lastTime;
            const newPageX = e.pageX;
            
            if (dt > 0) {
                const dx = newPageX - lastPageX;
                // Calculate velocity in pixels per frame (assuming ~16ms frame)
                velX = (dx / dt) * 16;
            }
            
            lastPageX = newPageX;
            lastTime = now;

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
            
            // Prevent default drag behavior on the link itself to avoid dragging the URL
            link.addEventListener('dragstart', (e) => {
                e.preventDefault();
            });

            // Also prevent default drag behavior on images to avoid ghost images
            const img = link.querySelector('img');
            if (img) {
                img.addEventListener('dragstart', (e) => e.preventDefault());
            }
        });
    });

    // Search Page Logic
    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');

    if (searchForm && searchInput) {
        // Handle search submission
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent default form submission
                const query = searchInput.value.trim();
                if (query) {
                    const profileId = window.location.pathname.split('/')[2];
                    
                    // Use View Transitions API if available
                    if (document.startViewTransition) {
                        document.startViewTransition(() => {
                            window.location.href = `/streaming/${profileId}/search?q=${encodeURIComponent(query)}`;
                        });
                    } else {
                        window.location.href = `/streaming/${profileId}/search?q=${encodeURIComponent(query)}`;
                    }
                }
            }
        });
    }

    // Search Overlay Logic
    const navSearchBtn = document.getElementById('navSearchBtn');
    const searchOverlay = document.getElementById('searchOverlay');
    const closeSearchBtn = document.getElementById('closeSearchBtn');
    const overlaySearchInput = document.getElementById('overlaySearchInput');
    const overlaySearchForm = document.getElementById('overlaySearchForm');

    if (navSearchBtn && searchOverlay && closeSearchBtn && overlaySearchInput) {
        // Open overlay
        navSearchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            searchOverlay.classList.add('active');
            overlaySearchInput.focus();
            document.body.style.overflow = 'hidden'; // Prevent scrolling
        });

        // Close overlay
        const closeOverlay = () => {
            searchOverlay.classList.remove('active');
            document.body.style.overflow = '';
            overlaySearchInput.value = ''; // Clear input
        };

        closeSearchBtn.addEventListener('click', closeOverlay);

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && searchOverlay.classList.contains('active')) {
                closeOverlay();
            }
        });

        // Handle overlay search submission
        overlaySearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = overlaySearchInput.value.trim();
                if (query) {
                    const profileId = window.location.pathname.split('/')[2];
                    
                    // Close overlay first
                    closeOverlay();

                    // Navigate to search page
                    if (document.startViewTransition) {
                        document.startViewTransition(() => {
                            window.location.href = `/streaming/${profileId}/search?q=${encodeURIComponent(query)}`;
                        });
                    } else {
                        window.location.href = `/streaming/${profileId}/search?q=${encodeURIComponent(query)}`;
                    }
                }
            }
        });
    }

    // Client-side Search Results Fetching
    const searchResultsContainer = document.getElementById('searchResultsContainer');
    if (searchResultsContainer) {
        const query = searchResultsContainer.getAttribute('data-query');
        const profileId = searchResultsContainer.getAttribute('data-profile-id');
        const grid = document.getElementById('searchResultsGrid');

        if (query && profileId && grid) {
            // Fetch results
            fetch(`/api/streaming/search?q=${encodeURIComponent(query)}&profileId=${profileId}`)
                .then(res => {
                    if (!res.ok) throw new Error('Search failed');
                    return res.json();
                })
                .then(data => {
                    grid.innerHTML = ''; // Clear loading spinner
                    
                    if (!data.results || data.results.length === 0) {
                        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">No results found.</div>';
                        return;
                    }

                    data.results.forEach(item => {
                        const card = document.createElement('a');
                        card.href = `/streaming/${profileId}/${item.type}/${item.id}`;
                        card.className = 'media-card';
                        
                        // Check if in list (this would require fetching list status or including it in response)
                        // For now, we'll skip the checkmark or fetch it separately if needed
                        // But ideally the API should return it.
                        
                        let posterHtml = '';
                        if (item.poster) {
                            posterHtml = `<img src="${item.poster}" alt="${item.name}" class="poster-image" loading="lazy" />`;
                        } else {
                            posterHtml = `<div class="no-poster">${item.name}</div>`;
                        }

                        let ratingHtml = '';
                        if (item.imdbRating) {
                            ratingHtml = `
                                <div class="imdb-rating-badge">
                                    <span class="iconify" data-icon="lucide:star" data-width="10" data-height="10"></span>
                                    ${item.imdbRating}
                                </div>
                            `;
                        }

                        card.innerHTML = `
                            <div class="poster-container">
                                ${ratingHtml}
                                ${posterHtml}
                                <div class="card-overlay">
                                    <div class="card-title">${item.name}</div>
                                </div>
                            </div>
                        `;
                        
                        // Add animation delay based on index
                        // We can't easily do nth-child in JS without loop index, but CSS handles it for first 10
                        // If we want to be precise:
                        // card.style.animationDelay = `${index * 0.05}s`;
                        
                        grid.appendChild(card);
                    });
                })
                .catch(err => {
                    console.error('Search error:', err);
                    grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #e50914;">Error loading results.</div>';
                });
        }
    }

    // Navigation Marker Animation
    const navBar = document.querySelector('.streaming-navbar');
    const navLinks = document.querySelectorAll('.nav-link, .nav-profile');
    
    if (navBar && navLinks.length > 0) {
        // Create and append the marker
        const marker = document.createElement('div');
        marker.classList.add('nav-marker');
        marker.style.opacity = '0'; // Start hidden to prevent initial jump
        // Append to navBar directly so it can move between sections (nav-left and nav-right)
        navBar.appendChild(marker);

        function moveMarker(target, skipTransition = false) {
            if (!target) return;
            
            if (skipTransition) {
                marker.style.transition = 'none';
            } else {
                // Restore transition from CSS or set explicitly if needed
                marker.style.transition = '';
            }

            // Check if we are in mobile view (horizontal layout)
            const isMobile = window.innerWidth <= 1024;
            const navRect = navBar.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();

            // Calculate position relative to the navbar container
            const leftPosition = targetRect.left - navRect.left;
            const topPosition = targetRect.top - navRect.top;

            // Apply dimensions and position
            marker.style.width = `${target.offsetWidth}px`;
            marker.style.height = `${target.offsetHeight}px`;
            
            // Copy border radius to match target shape (circle for profile, rounded rect for links)
            const targetStyle = window.getComputedStyle(target);
            marker.style.borderRadius = targetStyle.borderRadius;

            // Ensure marker is visible
            marker.style.opacity = '1';

            if (isMobile) {
                // Mobile: Horizontal layout
                marker.style.transform = `translateX(${leftPosition}px)`;
                marker.style.top = `${topPosition}px`;
                marker.style.left = '0';
            } else {
                // Desktop: Vertical layout
                marker.style.transform = `translateY(${topPosition}px)`;
                marker.style.top = '0';
                marker.style.left = `${leftPosition}px`;
            }
            
            // Force reflow if we skipped transition to ensure the position applies instantly
            if (skipTransition) {
                void marker.offsetWidth;
                // We don't restore transition immediately here because the next frame might still be processing
                // Instead, we let the next moveMarker call restore it, or restore it in a timeout
                setTimeout(() => {
                    marker.style.transition = '';
                }, 50);
            }

            // Update active class
            navLinks.forEach(link => link.classList.remove('active'));
            target.classList.add('active');

        }

        // Handle window resize
        window.addEventListener('resize', () => {
            const activeLink = document.querySelector('.nav-link.active, .nav-profile.active');
            if (activeLink) {
                moveMarker(activeLink, true);
            }
        });

        // Helper to find link for a path
        function findLinkForPath(path) {
            const pathBase = path.split('?')[0];
            
            // Try exact match first
            for (const link of navLinks) {
                const href = link.getAttribute('href');
                if (!href) continue;
                const hrefPath = href.split('?')[0];
                if (hrefPath === pathBase) return link;
            }
            
            // Try subpath match
            for (const link of navLinks) {
                const href = link.getAttribute('href');
                if (!href) continue;
                const hrefPath = href.split('?')[0];
                
                if (hrefPath !== '#' && pathBase.startsWith(hrefPath)) {
                    const nextChar = pathBase.charAt(hrefPath.length);
                    if (nextChar === '/' || nextChar === '') {
                        const hrefParts = hrefPath.split('/').filter(Boolean);
                        // Only allow subpath matching for non-root links (length > 2)
                        // e.g. /streaming/1/library matches /streaming/1/library/123
                        // but /streaming/1 should not match /streaming/1/library
                        if (hrefParts.length > 2) {
                            return link;
                        }
                    }
                }
            }
            return null;
        }

        // Initialize marker position
        setTimeout(() => {
            const currentPath = window.location.pathname;
            const currentLink = findLinkForPath(currentPath);
            
            // Check if we came from another page in the app
            const prevPath = sessionStorage.getItem('zentrio_nav_from');
            sessionStorage.removeItem('zentrio_nav_from');
            
            let animated = false;

            if (prevPath && currentLink) {
                const prevLink = findLinkForPath(prevPath);
                
                // If we have a previous link and it's different from current, animate between them
                if (prevLink && prevLink !== currentLink) {
                    // 1. Start at previous position (no animation)
                    moveMarker(prevLink, true);
                    
                    // 2. Force reflow
                    void marker.offsetWidth;
                    
                    // 3. Animate to new position
                    // We need to ensure transition is enabled. moveMarker(..., false) does this.
                    // Use a slight delay to ensure the browser registers the starting position
                    requestAnimationFrame(() => {
                        moveMarker(currentLink, false);
                    });
                    animated = true;
                }
            }
            
            if (!animated) {
                if (currentLink) {
                    moveMarker(currentLink, true);
                } else {
                    marker.style.opacity = '0';
                }
            }
        }, 50);

        // Add click listeners
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                
                // Prevent default if it's just a hash link
                if (href === '#') {
                    e.preventDefault();
                }
                
                // Store current path for animation on next page
                if (href && href !== '#' && link.getAttribute('target') !== '_blank') {
                    sessionStorage.setItem('zentrio_nav_from', window.location.pathname);
                }

                // For hash links or external, move immediately
                if (href === '#' || link.getAttribute('target') === '_blank') {
                     moveMarker(e.currentTarget);
                }
            });
        });
    }
});

// Hero Banner Cycling
document.addEventListener('DOMContentLoaded', () => {
    const heroSection = document.getElementById('heroSection');
    if (!heroSection) return;

    const itemsData = heroSection.getAttribute('data-items');
    if (!itemsData) return;

    let items = [];
    try {
        items = JSON.parse(itemsData);
    } catch (e) {
        console.error('Failed to parse hero items', e);
        return;
    }

    if (items.length <= 1) return;

    // Randomize initial index
    let currentIndex = Math.floor(Math.random() * items.length);
    const intervalTime = 15000; // 15 seconds
    let intervalId;

    const ambientBackground = document.getElementById('ambientBackground');
    const heroImage = document.getElementById('heroImage');
    const heroTitle = document.getElementById('heroTitle');
    const heroDescription = document.getElementById('heroDescription');
    const heroPlayBtn = document.getElementById('heroPlayBtn');
    const heroMoreBtn = document.getElementById('heroMoreBtn');
    const trendingText = document.getElementById('trendingText');

    // Initial render if random index is not 0
    if (currentIndex !== 0) {
        updateHero(currentIndex, true); // true = immediate update without fade out
    }

    // Preload images
    items.forEach(item => {
        if (item.background) {
            const img = new Image();
            img.src = item.background;
        }
        if (item.poster) {
            const img = new Image();
            img.src = item.poster;
        }
    });

    function updateHero(index, immediate = false) {
        const item = items[index];
        if (!item) return;

        if (!immediate) {
            // Fade out content
            heroSection.classList.add('fading');
            if (ambientBackground) ambientBackground.classList.add('fading');
        }

        const delay = immediate ? 0 : 500;

        setTimeout(() => {
            // Update content
            if (ambientBackground) {
                ambientBackground.style.backgroundImage = `url(${item.background || item.poster})`;
            }

            if (heroImage) {
                if (item.background) {
                    heroImage.src = item.background;
                    heroImage.style.filter = '';
                    heroImage.style.transform = '';
                } else if (item.poster) {
                    heroImage.src = item.poster;
                    heroImage.style.filter = 'blur(20px)';
                    heroImage.style.transform = 'scale(1.1)';
                } else {
                    heroImage.src = '';
                    heroImage.style.background = '#141414';
                }
            }

            if (heroTitle) heroTitle.textContent = item.title || item.name;
            if (heroDescription) heroDescription.textContent = item.description || '';
            
            if (trendingText) {
                trendingText.textContent = `#${index + 1} Trending Today`;
            }

            const profileId = window.location.pathname.split('/')[2];
            const playLink = `/streaming/${profileId}/${item.meta_type || item.type}/${item.meta_id || item.id}`;
            
            if (heroPlayBtn) heroPlayBtn.href = playLink;
            if (heroMoreBtn) heroMoreBtn.href = playLink;

            if (!immediate) {
                // Force reflow to ensure the fade-in transition triggers
                void heroSection.offsetWidth;
                
                // Fade in
                heroSection.classList.remove('fading');
                if (ambientBackground) ambientBackground.classList.remove('fading');
            }
        }, delay); // Wait for fade out
    }

    function nextHero() {
        currentIndex = (currentIndex + 1) % items.length;
        updateHero(currentIndex);
    }

    // Start cycling
    intervalId = setInterval(nextHero, intervalTime);

    // Pause on hover
    heroSection.addEventListener('mouseenter', () => {
        clearInterval(intervalId);
    });

    heroSection.addEventListener('mouseleave', () => {
        intervalId = setInterval(nextHero, intervalTime);
    });
});