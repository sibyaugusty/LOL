$(document).ready(function () {
    let currentVersion = '';
    let currentLanguage = 'en_US'; 
    let championIdMap = {}; 

    // Initializing the application
    initializeApp();

    // Initializing the application by fetching necessary data
    function initializeApp() {
        initializeSearch();
        initializeAbilityVideos();
        handleContainerExpansion();
        initializeHorizontalScroll();

        // fetching the latest game version
        fetchLatestVersion()
            .then(() => {
                // Then fetching and loading languages
                return fetchLanguages();
            })
            .then(() => {
                // Then loading champions with the current version and language
                return loadChampions();
            })
            .catch(error => {
                console.error('Error initializing app:', error);
                alert('There was an error loading data from Riot API. Please try again later.');
            });
    }

    // Function to fetch the latest game version
    function fetchLatestVersion() {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: 'https://ddragon.leagueoflegends.com/api/versions.json',
                type: 'GET',
                dataType: 'json',
                success: function (data) {
                    if (data && data.length > 0) {
                        currentVersion = data[0];
                        console.log(`Latest LoL version: ${currentVersion}`);
                        resolve();
                    } else {
                        reject('No version data available');
                    }
                },
                error: function (error) {
                    console.error('Error fetching versions:', error);
                    reject(error);
                }
            });
        });
    }

    // Function to fetch languages from the API
    function fetchLanguages() {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: 'https://ddragon.leagueoflegends.com/cdn/languages.json',
                type: 'GET',
                dataType: 'json',
                success: function (data) {
                    populateLanguageSelector(data);
                    resolve();
                },
                error: function (error) {
                    console.error('Error fetching languages:', error);
                    // Fallback to common languages if API fails
                    const fallbackLanguages = ['en_US', 'ko_KR', 'ja_JP', 'zh_CN', 'fr_FR', 'de_DE', 'es_ES', 'it_IT', 'pl_PL', 'ru_RU'];
                    populateLanguageSelector(fallbackLanguages);
                    resolve(); // Still resolve to continue the chain
                }
            });
        });
    }

    // Function to load champions based on the current version and language
    function loadChampions() {
        return new Promise((resolve, reject) => {
            if (!currentVersion) {
                reject('No version available');
                return;
            }

            $('.champions-list').empty();

            $('.champions-list').append('<div class="loading">Loading champions...</div>');

            $.ajax({
                url: `https://ddragon.leagueoflegends.com/cdn/${currentVersion}/data/${currentLanguage}/champion.json`,
                type: 'GET',
                dataType: 'json',
                success: function (data) {
                    $('.loading').remove();

                    if (data && data.data) {
                        // Creating champion ID map for videos
                        Object.keys(data.data).forEach(champKey => {
                            const champion = data.data[champKey];
                            championIdMap[champion.id] = champion.key;
                        });

                        // Populating champion grid
                        populateChampionGrid(data.data);

                        // Loading the first champion by default
                        const firstChampionId = Object.keys(data.data)[0];

                        // Marking the first champion card as active
                        $(`.champion-card[data-champion="${firstChampionId}"]`).addClass('active');

                        // Loading champion details and storing champion data in a variable for ability clicks
                        window.currentChampionData = null;
                        loadChampionDetails(firstChampionId);

                        // Trigger event with champion data for video system
                        $(document).trigger('championsLoaded', [data.data]);

                        resolve();
                    } else {
                        reject('Invalid champion data format');
                    }
                },
                error: function (error) {
                    console.error('Error fetching champions:', error);
                    $('.loading').text('Error loading champions. Please try again.');
                    reject(error);
                }
            });
        });
    }

    // Function to populate the champion grid
    function populateChampionGrid(championsData) {
        const championsListElement = $('.champions-list');

        // Sorting champions alphabetically by name
        const sortedChampions = Object.values(championsData).sort((a, b) =>
            a.name.localeCompare(b.name)
        );

        // Adding each champion to the grid
        sortedChampions.forEach(champion => {
            const championImageUrl = `https://ddragon.leagueoflegends.com/cdn/${currentVersion}/img/champion/${champion.image.full}`;

            const championCard = $(`
                <div class="champion-card" data-champion="${champion.id}">
                    <img src="${championImageUrl}" alt="${champion.name}">
                    <span>${champion.name}</span>
                </div>
            `);

            championsListElement.append(championCard);
        });

        // Removing any existing click handlers first
        $('.champions-list').off('click', '.champion-card');

        // Using delegated event handling for champion cards
        $('.champions-list').on('click', '.champion-card', function (e) {
            const championId = $(this).data('champion');

            // Updating active state
            $('.champion-card').removeClass('active');
            $(this).addClass('active');

            // Loading champion details
            loadChampionDetails(championId);
        });
    }

    // Function to load champion details
    function loadChampionDetails(championId) {
        $.ajax({
            url: `https://ddragon.leagueoflegends.com/cdn/${currentVersion}/data/${currentLanguage}/champion/${championId}.json`,
            type: 'GET',
            dataType: 'json',
            success: function (data) {
                if (data && data.data && data.data[championId]) {
                    // Storing the champion data globally for ability clicks
                    window.currentChampionData = data.data[championId];

                    // Displaying the champion details
                    displayChampionDetails(data.data[championId]);

                    //  first ability (passive) is marking as active
                    $('.ability-icon-wrapper').removeClass('active');
                    $('.ability-icon-wrapper[data-ability="passive"]').addClass('active');

                    // Updating the ability description for the passive by default
                    updateAbilityDescription('passive', data.data[championId]);

                    // Trigger ability selected event
                    $(document).trigger('abilitySelected', [championId, 'passive']);
                }
            },
            error: function (error) {
                console.error(`Error fetching details for ${championId}:`, error);
            }
        });
    }

    // Function to display champion details
    function displayChampionDetails(champion) {
        // Updating champion name and title
        $('.champion-name').text(champion.name);
        $('.champion-title').text(champion.title);

        // Updating roles and difficulty
        $('.champion-roles span').text(champion.tags.join(', '));

        // Set difficulty stars (1-3 based on champion info)
        const difficultyLevel = Math.min(Math.ceil(champion.info.difficulty / 3), 3);
        const difficultyStars = '★'.repeat(difficultyLevel) + '☆'.repeat(3 - difficultyLevel);
        $('.champion-difficulty span').text(difficultyStars);

        // Updating description
        $('.champion-description').text(champion.blurb);

        // Updating main champion image
        const splashImageUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champion.id}_0.jpg`;
        $('.champion-image').attr('src', splashImageUrl);

        // Updating abilities
        updateAbilities(champion);

        // Updating skins
        updateSkins(champion);

        // Adjust container height after content update
        setTimeout(adjustContainerHeight, 100);
    }

    // Function to update abilities display
    function updateAbilities(champion) {
        // Set passive ability
        if (champion.passive) {
            const passiveIconUrl = `https://ddragon.leagueoflegends.com/cdn/${currentVersion}/img/passive/${champion.passive.image.full}`;
            $('.ability-icon.passive').css('background-image', `url(${passiveIconUrl})`);
        }

        // Set Q, W, E, R abilities
        champion.spells.forEach((spell, index) => {
            const abilityKeys = ['q', 'w', 'e', 'r'];
            if (index < abilityKeys.length) {
                const spellIconUrl = `https://ddragon.leagueoflegends.com/cdn/${currentVersion}/img/spell/${spell.image.full}`;
                $(`.ability-icon.${abilityKeys[index]}`).css('background-image', `url(${spellIconUrl})`);
            }
        });
    }

    // Function to update ability description
    function updateAbilityDescription(abilityType, champion) {
        let abilityName, abilityDesc;

        if (abilityType === 'passive') {
            abilityName = `Passive: ${champion.passive.name}`;
            abilityDesc = champion.passive.description;
        } else {
            const spellIndex = {
                'q': 0,
                'w': 1,
                'e': 2,
                'r': 3
            };

            const spell = champion.spells[spellIndex[abilityType]];
            if (spell) {
                abilityName = `${abilityType.toUpperCase()}: ${spell.name}`;
                abilityDesc = spell.description;
            }
        }

        // Updating the DOM elements
        $('#ability-name').html(abilityName);
        $('#ability-description').html(abilityDesc);
    }

    // Function to update skins preview
    function updateSkins(champion) {
        const skinsContainer = $('.skins-preview');
        skinsContainer.empty();

        // Add default skin
        skinsContainer.append(`
            <div class="skin-thumbnail active" data-skin="0">
                Default
            </div>
        `);

        // Add other skins (limiting to first 5 to save space)
        champion.skins.slice(1, 6).forEach(skin => {
            skinsContainer.append(`
                <div class="skin-thumbnail" data-skin="${skin.num}">
                    ${skin.name}
                </div>
            `);
        });

        // Add skin click event
        $('.skin-thumbnail').click(function () {
            const skinId = $(this).data('skin');

            // Updating active skin
            $('.skin-thumbnail').removeClass('active');
            $(this).addClass('active');

            // Updating champion image with selected skin
            const skinImageUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champion.id}_${skinId}.jpg`;
            $('.champion-image').attr('src', skinImageUrl);
        });
    }

    // Ability selection event
    $(document).on('click', '.ability-icon-wrapper', function () {
        // Get ability type
        const abilityType = $(this).data('ability');

        // Updating active state
        $('.ability-icon-wrapper').removeClass('active');
        $(this).addClass('active');

        // Updating ability description using stored champion data
        if (window.currentChampionData) {
            updateAbilityDescription(abilityType, window.currentChampionData);

            // Get current champion ID from the stored data
            const currentChampionId = window.currentChampionData.id;

            // Trigger custom event for video handling
            $(document).trigger('abilitySelected', [currentChampionId, abilityType]);

            // Adjust container heights after content update
            setTimeout(adjustContainerHeight, 100);
        } else {
            console.error('No champion data available for ability display');
        }
    });

    // Language selector change event
    $('#language-selector').change(function () {
        currentLanguage = $(this).val();
        changeLanguage(currentLanguage);
    });

    // Function to populate language selector with options
    function populateLanguageSelector(languages) {
        const selector = $('#language-selector');

        // Clear existing options except the placeholder
        selector.find('option:not([disabled])').remove();

        // Add each language as an option
        languages.forEach(lang => {
            const displayName = formatLanguageName(lang);
            selector.append(`<option value="${lang}">${displayName}</option>`);
        });

        // Set default language
        selector.val(currentLanguage);
    }

    // Function to format language codes into readable names
    function formatLanguageName(langCode) {
        const langMap = {
            'en_US': 'English (US)',
            'en_GB': 'English (UK)',
            'ko_KR': 'Korean',
            'ja_JP': 'Japanese',
            'zh_CN': 'Chinese (Simplified)',
            'zh_TW': 'Chinese (Traditional)',
            'fr_FR': 'French',
            'de_DE': 'German',
            'es_ES': 'Spanish (Spain)',
            'es_MX': 'Spanish (Mexico)',
            'it_IT': 'Italian',
            'pl_PL': 'Polish',
            'pt_BR': 'Portuguese (Brazil)',
            'ru_RU': 'Russian',
            'tr_TR': 'Turkish'
        };

        return langMap[langCode] || langCode;
    }

    // Function to change the language and reload data
    function changeLanguage(language) {
        console.log(`Changing language to: ${language}`);

        // Reload champions with the new language
        loadChampions();

        // Trigger custom event for search reset
        $(document).trigger('languageChanged');
    }

    // Search functionality
    function initializeSearch() {
        const searchInput = $('#champion-search');
        const clearButton = $('#clear-search-btn');

        // Search input event
        searchInput.on('input', function () {
            const searchValue = $(this).val().toLowerCase().trim();

            // Show/hide clear button
            if (searchValue.length > 0) {
                clearButton.addClass('visible');
            } else {
                clearButton.removeClass('visible');
            }

            // Filter champions
            filterChampions(searchValue);
        });

        // Clear search button
        clearButton.on('click', function () {
            searchInput.val('');
            clearButton.removeClass('visible');
            filterChampions('');
            searchInput.focus();
        });

        // Reset search when language changes
        $(document).on('languageChanged', function () {
            searchInput.val('');
            clearButton.removeClass('visible');
        });
    }

    // Function to filter champions based on search
    function filterChampions(searchTerm) {
        if (!searchTerm) {
            // If search is empty, show all champions
            $('.champion-card').show();
            $('.no-results').remove();
            return;
        }

        // Loop through all champion cards
        $('.champion-card').each(function () {
            const championName = $(this).find('span').text().toLowerCase();

            // Show/hide based on match
            if (championName.includes(searchTerm)) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });

        // Check if no results
        const visibleCards = $('.champion-card:visible').length;

        if (visibleCards === 0) {
            // If no champions match, show a message
            if ($('.no-results').length === 0) {
                $('.champions-list').append('<div class="no-results">No champions found</div>');
            }
        } else {
            // Removing no results message if it exists
            $('.no-results').remove();
        }
    }

    // Ability video functionality
    function initializeAbilityVideos() {
        const watchButton = $('#watch-video-btn');
        const closeButton = $('#close-video-btn');
        const videoSection = $('#ability-video-section');
        const abilityVideo = $('#ability-video');

        // Initially hide the button (until ability is selected)
        watchButton.hide();

        // Watch button click event
        watchButton.click(function () {
            // Show video section
            videoSection.slideDown(300);

            // Get current champion and ability
            const currentChampion = $('.champion-card.active').data('champion');
            const currentAbility = $('.ability-icon-wrapper.active').data('ability');

            // Loading and play video
            loadAbilityVideo(currentChampion, currentAbility);

            // Adjust container after video shows
            setTimeout(function () {
                adjustContainerHeight();
                // Scroll to video
                videoSection[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 350);
        });

        // Close button click event
        closeButton.click(function () {
            // Hide video section
            videoSection.slideUp(300);

            // Pause video
            abilityVideo[0].pause();

            // Readjust container
            setTimeout(adjustContainerHeight, 350);
        });

        // Add to ability selection event
        $(document).on('abilitySelected', function (e, champion, ability) {
            // Always try to show the button - Riot has videos for most abilities
            watchButton.show();

            // Hide video section when changing abilities
            videoSection.slideUp(300);
            abilityVideo[0].pause();

            // Clear any error messages
            $('.video-error').remove();

            // Adjust container
            setTimeout(adjustContainerHeight, 300);
        });
    }

    // Function to load ability video using Riot's format
    function loadAbilityVideo(championId, abilityType) {
        const video = $('#ability-video');

        // Clear existing sources
        video.empty();
        $('.video-error').remove();

        // Get champion numeric ID
        const numericId = championIdMap[championId];

        // If we don't have an ID mapping, show an error
        if (!numericId) {
            console.error(`No numeric ID found for champion: ${championId}`);
            video.after('<p class="video-error">Video unavailable for this champion</p>');
            return;
        }

        // Pad the ID to 4 digits
        const paddedId = numericId.padStart(4, '0');

        // Map ability type to Riot's format
        let abilityKey;
        switch (abilityType) {
            case 'passive':
                abilityKey = 'P1';
                break;
            case 'q':
                abilityKey = 'Q1';
                break;
            case 'w':
                abilityKey = 'W1';
                break;
            case 'e':
                abilityKey = 'E1';
                break;
            case 'r':
                abilityKey = 'R1';
                break;
            default:
                abilityKey = 'P1';
        }

        // Construct video URL using Riot's format
        const videoUrl = `https://d28xe8vt774jo5.cloudfront.net/champion-abilities/${paddedId}/ability_${paddedId}_${abilityKey}.webm`;

        // Add new source and load video
        video.append(`<source src="${videoUrl}" type="video/webm">`);
        video[0].load();

        // Handle video errors
        video.on('error', function () {
            console.error(`Failed to load video: ${videoUrl}`);
            $('.video-error').remove();
            video.after('<p class="video-error">This ability video is unavailable</p>');
        });

        // Add play handler with slight delay to ensure loading
        setTimeout(() => {
            try {
                video[0].play();
            } catch (e) {
                console.log('Video autoplay prevented by browser');
            }
        }, 300);
    }

    // Dynamic container expansion for ability descriptions
    function handleContainerExpansion() {
        // Listen for window resize events
        $(window).on('resize', debounce(adjustContainerHeight, 250));
    }

    // Function to adjust container heights based on content
    function adjustContainerHeight() {
        // Get the current height of all components
        const detailsHeight = $('.champion-details').prop('scrollHeight');
        const videoVisible = $('#ability-video-section').is(':visible');

        // If we're on mobile, handle differently
        if ($(window).width() <= 767) {
            // On mobile, allow natural flow due to column layout
            $('.champion-details').css('height', 'auto');
            $('.ability-description-container').css('max-height', 'none');

            // If video is visible, ensure enough space
            if (videoVisible) {
                $('.top-container').css('min-height', 'auto');
            }
        } else {
            // On desktop, ensure all content is visible
            $('.champion-details').css('height', 'auto');
            $('.ability-description-container').css('max-height', 'none');

            // If video is visible, ensure container is tall enough
            if (videoVisible) {
                const totalHeight = detailsHeight + 40; // Add padding
                $('.top-container').css('min-height', totalHeight + 'px');
            }
        }
    }

    // Horizontal scroll functionality - only for desktop
    function initializeHorizontalScroll() {
        // Only apply this on non-touch devices (desktop/laptop)
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // If it's a touch device, don't apply custom scrolling
        if (isTouchDevice) {
            console.log('Touch device detected - using native scroll');
            return;
        }

        console.log('Desktop device detected - enabling custom horizontal scroll');

        // Apply custom horizontal scrolling for mouse/desktop
        const championsList = $('.champions-list');

        // Handle mousewheel event for horizontal scrolling (desktop only)
        championsList.on('wheel', function (event) {
            event.preventDefault();

            const scrollAmount = event.originalEvent.deltaY !== 0 ?
                event.originalEvent.deltaY : event.originalEvent.deltaX;

            $(this).scrollLeft($(this).scrollLeft() + scrollAmount);
        });

        // Add keyboard navigation
        championsList.attr('tabindex', '0');
        championsList.on('keydown', function (e) {
            if (e.keyCode === 37) { // Left arrow
                $(this).scrollLeft($(this).scrollLeft() - 100);
                e.preventDefault();
            } else if (e.keyCode === 39) { // Right arrow
                $(this).scrollLeft($(this).scrollLeft() + 100);
                e.preventDefault();
            }
        });
    }

    // Debounce function to prevent excessive calculations
    function debounce(func, wait) {
        let timeout;
        return function () {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(function () {
                func.apply(context, args);
            }, wait);
        };
    }
});
