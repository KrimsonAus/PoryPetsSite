const supabaseUrl = 'https://rzoqmijpowzdpkjnrtgq.supabase.co';
const supabaseKey = 'sb_publishable_BugyRbyaQWz0U8CxrYlmAQ_ctW_sx_L';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Get HTML elements
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const usernameInput = document.getElementById('username-input');
const loginBtn = document.getElementById('login-btn');
const statusMessage = document.getElementById('status-message');

const loginPanel = document.getElementById('login-panel');

const spriteUrl = "https://rzoqmijpowzdpkjnrtgq.supabase.co/storage/v1/object/public/";

let shopItemType = 0; //toys, food, pets

let hasLoginData = false;
let hasLoggedIn = false;

let loggedInSession;

let completedTutorial;

//TODO [petname] in buy pet dialogue
//TODO ground collider absorbs clicks?
//TODO purchase conformation
//TODO copy header
//

hasCompletedTutorial()

async function hasCompletedTutorial() {
    const {data: {user}, error: authError} = await supabaseClient.auth.getUser();

    // Prevent crash if user is not logged in yet
    if (!user) return false;

    let userId = user.id;
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('tutorial_completed')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        console.error("Database error:", error);
        return false;
    }

    if (!data) {
        console.warn("No profile found. Assuming tutorial is not completed.");
        const tutorialPanel = document.getElementById('tutorial-panel');
        tutorialPanel.style.visibility = 'visible';
        return false;
    }

    // Evaluate the actual database boolean before logging
    if (data.tutorial_completed) {
        console.log('Player has completed the tutorial.');
    } else {
        console.log('Player profile found, but tutorial is NOT completed.');
        const tutorialPanel = document.getElementById('tutorial-panel');
        tutorialPanel.style.visibility = 'visible';
    }

    completedTutorial = data.tutorial_completed;
    return data.tutorial_completed;
}

// Add click event to the login button
if (loginBtn != null) {
    loginBtn.addEventListener('click', async () => {
        const email = emailInput.value;
        const password = passwordInput.value;

        statusMessage.textContent = "Logging in...";
        statusMessage.style.color = "black";

        // Attempt to sign in via Supabase
        const {data, error} = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            // Handle incorrect passwords or missing accounts
            statusMessage.textContent = "Error: " + error.message;
            statusMessage.style.color = "red";
        } else {
            // Success! Display the user's email
            statusMessage.textContent = "Logged in as: " + data.user.email;
            statusMessage.style.color = "green";

            // Hide the inputs and button after successful login
            emailInput.parentElement.style.display = 'none';
            passwordInput.parentElement.style.display = 'none';
            loginBtn.style.display = 'none';

            loginPanel.style.display = 'none';

            statusMessage.textContent = "Logged in as: " + data.user.email;
            document.querySelector('.loginPanel').style.display = 'none';

            // 2. Package the tokens into a JSON string
            const sessionData = {
                accessToken: data.session.access_token,
                refreshToken: data.session.refresh_token
            };

            // 3. Send the JSON string into the Unity WebGL instance
            // Note: Ensure 'unityInstance' matches whatever variable name your WebGL template uses
            // 'DatabaseManager' is the name of the GameObject in your Unity scene
            // 'ReceiveWebSession' is the C# method we are about to create
            const gameIframe = document.querySelector('iframe');

// 2. Check if the iframe exists and if Unity is ready inside it
            if (gameIframe && gameIframe.contentWindow.myUnityInstance) {

                // 3. Reach into the iframe's window to send the message
                gameIframe.contentWindow.myUnityInstance.SendMessage('DatabaseManager', 'ReceiveWebSession', JSON.stringify(sessionData));

            } else {
                console.warn("Unity is not loaded inside the iframe yet!");
                statusMessage.textContent = "Logged in! Waiting for the game to finish loading...";
            }
            await UpdateGoldText();

        }
    });
}

async function UpdateGoldText() {
    const goldText = document.getElementById('goldAmount');
    let gold = 0;
    gold = await fetchPlayerGold();

    goldText.textContent = `Gold: ${gold}`
}

async function fetchPlayerGold() {
    // 1. Get the current logged-in user
    const {data: {user}, error: authError} = await supabaseClient.auth.getUser();

    if (authError || !user) {
        console.error("User not logged in.");
        return 0;
    }

    // 2. Fetch the gold using the .eq() filter
    const {data, error} = await supabaseClient
        .from('player_economy')
        .select('gold')
        .eq('id', user.id) // <- This specifically targets the logged-in player
        .eq('id', user.id) // <- This specifically targets the logged-in player
        .single(); // .single() now safely expects exactly one row

    if (error) {
        // Error code PGRST116 means the database found zero rows.
        // This happens if a brand new player hasn't been granted their first batch of gold yet.
        if (error.code === 'PGRST116') {
            return 0;
        }
        if (statusMessage != null) {
            statusMessage.textContent = 'Failed to fetch gold.';
        }
        console.error("Failed to fetch gold:", error.message);
        return 0;
    }

    return data.gold;
}

function populateShop() {
    // 1. Find the grid container in your HTML
    const shopContainer = document.querySelector('.shopItems');
    console.log("popuing")
// 2. Loop 50 times
    for (let i = 1; i <= 50; i++) {
        // 3. Create the outer div
        const itemCard = document.createElement('div');
        itemCard.className = 'relative'; // Apply your CSS class

        // 4. Inject the inner HTML.
        // Notice the ${i} - this automatically numbers them "Item 1", "Item 2", etc.
        itemCard.innerHTML = `
        <img src="noit.jpg" alt="Item ${i}">
        <div class="bottom-center">Item ${i}</div>
    `;

        // 5. Attach the new item to the grid container
        shopContainer.appendChild(itemCard);
    }
}

let canClick = true;

async function loadShopGrid() {

    if (!canClick) {
        return;
    }
    canClick = false;
    const shopContainer = document.querySelector('.shopItems');
    const shopLoad = document.getElementById('shopLoad')
    if (!shopContainer) return;

    shopContainer.innerHTML = ''; // Clear out any existing items just in case
    shopLoad.style.display = 'block';

    let isle = 'items';
    let category = 'toy';

    if (shopItemType === 1) {
        category = 'food';
    } else if (shopItemType === 2) {
        isle = 'pets';
        category = null; // No category filter needed for pets
    }

// 1. Start the base query
    let query = supabaseClient
        .from(isle)
        .select('*')
        .eq('is_active', true);

// 2. Conditionally attach the category filter
    if (category) {
        query = query.eq('category', category);
    }

// 3. Execute the final query
    const {data: items, error} = await query;

    console.log("Error:", error);
    console.log("Fetched items:", items);
    if (error) {
        console.error("Failed to load shop items:", error);
        return;
    }


    shopLoad.style.display = 'none';
    // Loop through the actual database items instead of a basic 'for' loop
    items.forEach(item => {
        const itemCard = document.createElement('div');
        itemCard.className = 'relative shopItem';


        //food/apple.png
        // Use the actual item name and an image route (if you have one)
        // load from supabase bucket
        var sprite = null;
        if (category != null) {
            sprite = `${spriteUrl}item_sprites/${category}/${item.name.toLowerCase()}.png`;

            itemCard.onclick = async () => {
                await BuyItem(item.item_id);
            };
        } else {
            console.log("loading sprite no cat")
            sprite = `${spriteUrl}pet_sprites/${item.name.toLowerCase()}.png`;

            itemCard.onclick = async () => {
                //alert("want buy pet " + item.name)
                //alert("id is " + item.pet_id)
                await ShowBuyPetMenu(item.pet_id);
                //open pet buy window so can name
            };
        }

        var cost = item.cost;
        if (item.cost == undefined) {
            console.log("no cost")
            cost = "?"
        }
        //console.log(sprite)
        itemCard.innerHTML = `
            <img src='${sprite}' alt="${item.name}" onerror="this.src='noit.jpg'">
            
            <div class="bottom-center">${item.name}</div>
            <div class="bottom-center2">G ${cost}</div>
            <p class="center-center">BUY ITEM</p>
        `;

        shopContainer.appendChild(itemCard);
    });
    canClick = true;
}

function changeShopCategory(no) {
    shopItemType = no;
    loadShopGrid();
}

// Call this when the page loads or when the user opens the shop tab
loadShopGrid();

async function BuyItem(itemId) {
    // CORRECTED: Use 'supabaseClient' instead of 'supabase'
    if (!completedTutorial) {
        return;
    }
    const {data: success, error} = await supabaseClient
        .rpc('buy_item', {
            target_item: itemId
        });

    if (error) {
        console.error("Transaction failed:", error.message);
        return false;
    }

    // Optional: Refresh the player's gold display if the purchase succeeded
    if (success) {
        console.log("Purchase successful!");
        await UpdateGoldText();
    } else {
        console.log("Purchase failed: Not enough gold.");
    }

    return success; // Returns true if bought, false if not enough gold
}

async function getPetNameById(petId) {
    const {data, error} = await supabaseClient
        .from('pets')
        .select('name')
        .eq('pet_id', petId)
        .single();

    if (error) {
        console.error("Error fetching pet name:", error.message);
        return null;
    }

    return data.name;
}

async function ShowBuyPetMenu(petId) {
    let pet_id = petId;
    const buyPetMenu = document.getElementById('buy-pet-menu')
    const buyPetButton = document.getElementById('buy-pet-button')
    const cancelBuyPetButton = document.getElementById('cancel-buy-pet-button')
    const petName = document.getElementById('pet-name-input')
    const buyPetText = document.getElementById('buy-pet-what-pet');


    buyPetText.textContent = "You are buying a " + await getPetNameById(petId);

    buyPetMenu.style.visibility = 'visible';

    buyPetButton.addEventListener('click', () => TryBuyPet(pet_id, petName.value));
    cancelBuyPetButton.addEventListener('click', () => HideBuyMenu());
}

function HideBuyMenu() {
    const buyPetMenu = document.getElementById('buy-pet-menu');
    buyPetMenu.style.visibility = 'hidden';
}

function TryBuyPet(petId, petName) {
    if (!(petName !== "" && petName != null)) {
        const petMenuStatus = document.getElementById('pet-menu-status')
        petMenuStatus.textContent = "Need to name pet."
        return;
    }

    //alert("Buying: " + petId + " with name " + petName)
    BuyPet(petId, petName);
}

async function BuyPet(petId, petName) { // <- Add petName parameter
    const petMenuStatus = document.getElementById('pet-menu-status')
    //alert("buying pet (special case)");

    const {data: success, error} = await supabaseClient
        .rpc('buy_pet', {
            target_pet: petId,
            given_name: petName // <- Send it to Supabase
        });

    if (error) {
        console.error("Transaction failed:", error.message);

        petMenuStatus.textContent = error.message;
        if (error.message === "duplicate key value violates unique constraint \"player_pets_pen_pkey\"") {
            petMenuStatus.textContent = "You already have a pet with that name!";
        }
        return false;
    }

    if (success) {
        console.log("Purchase successful!");

        const buyPetMenu = document.getElementById('buy-pet-menu')
        buyPetMenu.style.visibility = 'hidden';
        await UpdateGoldText();
    } else {
        console.log("Purchase failed: Not enough gold.");

        petMenuStatus.textContent = "Not enough Gold...";
    }

    if (!completedTutorial) {
        completedTutorial = true;
        const {error: tutorialError} = await supabaseClient.rpc('set_tutorial_completed');
        if (tutorialError != null) {
            alert(tutorialError);
        }
    }

    return success;
}

// Check if the user is already logged in from a previous visit
async function checkExistingLogin() {
    const {data: {session}, error} = await supabaseClient.auth.getSession();

    if (session) {
        console.log("Welcome back! Loading saved session...");

        loggedInSession = session;
        // Update UI
        if (statusMessage != null) {
            statusMessage.textContent = "Logged in as: " + session.user.email;
            statusMessage.style.color = "green";
            loginPanel.style.display = 'none'; // Hide the login screen
        }
        // Package the existing tokens for Unity
        const sessionData = {
            accessToken: session.access_token,
            refreshToken: session.refresh_token
        };

        const gameIframe = document.querySelector('iframe');

        if (gameIframe && gameIframe.contentWindow.myUnityInstance) {
            gameIframe.contentWindow.myUnityInstance.SendMessage('DatabaseManager', 'ReceiveWebSession', JSON.stringify(sessionData));

        } else {
            console.warn("Unity is not loaded inside the iframe yet!");
            //alert("UNITY NOT READY!!!")
            if (statusMessage != null) {
                statusMessage.textContent = "Logged in! Waiting for the game to finish loading...";
            }
        }

        await UpdateGoldText();
    } else {
        console.log("No saved session found. User needs to log in.");
        // Ensure login panel is visible
        loginPanel.style.display = 'block';
    }
}

// Run the check immediately when the page loads
checkExistingLogin();

window.addEventListener("message", (event) => {
    // Do we trust the sender of this message? (might be
    // different from what we originally opened, for example).

    if (event.data === "loginready") {
        //alert("Received loginready from Unity!");

        checkExistingLogin();
    }
});

loadUsername()
loadDisplayName()

async function loadUsername() {

    const usernameText = document.getElementById('username')
    if (usernameText == null) {
        console.warn("no username text");
        return;
    }

    const logoutButton = document.getElementById('logoutButton');
    const logoutButtonG = document.getElementById('logoutButtonG');

    usernameText.style.color = "red";

    const {data: {user}, error: authError} = await supabaseClient.auth.getUser();

    if (loggedInSession == null) {
        window.location.replace('./index.html');
    }

    usernameText.style.color = "black";

    let ttd = user.user_metadata.username;

    usernameText.innerText = ttd;
    logoutButton.style.visibility = 'visible';
    logoutButtonG.style.visibility = 'visible';
}

async function loadDisplayName() {
    const {data: {user}, error: authError} = await supabaseClient.auth.getUser();

    if (user == null || authError) {
        //window.location.replace('./index.html');
        return;
    }

    const {data, error} = await supabaseClient
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();

    if (error) {
        console.error("Error fetching profile:", error.message);
        return;
    }

    //alert("display name is " + data.display_name);

    const displayNameText = document.getElementById('displayName');
    if (displayNameText == null) {
        console.warn("no display name text element found");
        return;
    }

    displayNameText.textContent = data.display_name;
}

async function LogOut() {
    await supabaseClient.auth.signOut({scope: 'local'})
    window.location.reload();
}

async function LogOutGlobal() {
    await supabaseClient.auth.signOut({scope: 'global'})
    window.location.reload();
}

async function SignUp() {
    const signupEmailInput = document.getElementById('signup-email-input')
    const signupPasswordInput = document.getElementById('signup-password-input')
    const signupUsernameInput = document.getElementById('signup-username-input')
    const statusMessage = document.getElementById('signup-status-message')
    const signupPanel = document.getElementById('signup-panel')


    const email = signupEmailInput.value;
    const password = signupPasswordInput.value;
    const username = signupUsernameInput.value;

    statusMessage.textContent = "Checking username...";
    statusMessage.style.color = "black";

    // 1. Check if the username is taken
    const {data: isAvailable, error: rpcError} = await supabaseClient.rpc("is_username_available", {
        username_to_check: username
    });

    if (rpcError) {
        console.error('Error checking username:', rpcError.message);
        statusMessage.style.color = "red";
        statusMessage.textContent = "Error connecting to the database.";
        return; // Stop execution
    }

    if (!isAvailable) {
        statusMessage.style.color = "red";
        statusMessage.textContent = "That username is already taken.";
        return; // Stop execution
    }

    statusMessage.textContent = "Creating account...";
    statusMessage.style.color = "black";

    alert("trying to signup with username " + username + " and display_name " + username);

    // 2. Proceed with sign up since the name is free
    const {data, error} = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                username: username,
                display_name: username
            }
        }
    });

    if (error) {
        console.error('Error signing up:', error.message);
        statusMessage.style.color = "red";
        statusMessage.textContent = error.message;
    } else {
        console.log('User created successfully:', data.user);
        statusMessage.style.color = "green";
        statusMessage.textContent = "Signed up successfully!";
        signupPanel.style.visibility = 'hidden';
        loginPanel.display = "none";

        await checkExistingLogin();
        await hasCompletedTutorial()
    }
}


function SignUpMenu() {
    const signupPanel = document.getElementById('signup-panel');
    signupPanel.style.visibility = 'visible';
}

function SetDisplayName() {
    console.log("setting display name...")
    ChangeDisplayName(usernameInput.value);
}

async function ChangeDisplayName(newDisplayName) {
    statusMessage.textContent = "Updating display name...";
    statusMessage.style.color = "black";

    // 1. Get the currently logged-in user
    const {data: {user}, error: authError} = await supabaseClient.auth.getUser();

    if (authError || !user) {
        statusMessage.style.color = "red";
        statusMessage.textContent = "You must be logged in to do this.";
        return;
    }

    // 2. Update the display name in the public profiles table
    const {error: profileError} = await supabaseClient
        .from('profiles')
        .update({display_name: newDisplayName})
        .eq('id', user.id);

    if (profileError) {
        console.error("Failed to update profile:", profileError.message);
        statusMessage.style.color = "red";
        statusMessage.textContent = "Error updating database.";
        return;
    }

    // 3. Update the hidden auth metadata so the dashboard stays in sync
    const {error: metaError} = await supabaseClient.auth.updateUser({
        data: {display_name: newDisplayName}
    });

    if (metaError) {
        console.warn("Profile updated, but auth metadata failed to sync:", metaError.message);
    }

    statusMessage.style.color = "green";
    statusMessage.textContent = "Display name successfully updated!";

    console.log("changed display name")
    await loadDisplayName();
}

DoTutorial();

async function DoTutorial() {
    const {data: {user}, error: authError} = await supabaseClient.auth.getUser();

    if (user == null || authError) {
        //.location.replace('./index.html');
        return;
    }

    const {data, error} = await supabaseClient
        .from('player_pets_pen')
        .select('*')
        .eq('player_id', user.id);

    if (error) {
        console.error("Database Error:", error.message);
        return;
    }

    if (data.length === 0) {
        //alert("You have no pets!");

        return;
    }

    console.log("Player has pets:", data);
}

async function CloseTutorialPanel() {
    const tutorialPanel = document.getElementById('tutorial-panel');
    tutorialPanel.style.visibility = 'hidden';

    const {data, error} = await supabaseClient.rpc('tutorial_claim_gold');

    if (error) {
        console.error("Failed to complete tutorial:", error.message);
        // If they already claimed it, error.message will say "Tutorial already completed."
        return;
    }

    UpdateGoldText();
}