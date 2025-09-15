import os
from playwright.sync_api import sync_playwright, Page, expect

def run_navigation_test(page: Page):
    """
    Navigates from the main page to a sub-page, ensuring no errors
    and that the destination page loads correctly.
    """
    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

    repo_path = "/app"
    main_page_url = f"file://{os.path.join(repo_path, 'index.html')}"

    page.goto(main_page_url)

    # Use a robust locator for the link to the "Cocinas" page
    cocinas_card_link = page.locator('a[href="cocinas/"]')

    # Wait for the card to be visible and then click it
    expect(cocinas_card_link).to_be_visible(timeout=10000)
    cocinas_card_link.click()

    # Wait for the new page to load by waiting for a unique element on that page.
    # This is a more reliable way to ensure navigation is complete.
    heading_on_cocinas_page = page.get_by_role("heading", name="Cocinas de Vanguardia")
    expect(heading_on_cocinas_page).to_be_visible(timeout=10000)

    # Check that no console errors occurred during the process
    assert len(console_errors) == 0, f"Console errors found: {console_errors}"

    # If all assertions pass, the navigation was successful. Take a screenshot.
    page.screenshot(path="jules-scratch/verification/navigation_success.png")
    print("Navigation successful, screenshot taken.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            run_navigation_test(page)
        finally:
            browser.close()
