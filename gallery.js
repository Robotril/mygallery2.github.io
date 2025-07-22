function upDate(previewPic) {
    document.getElementById("image").style.backgroundImage = "url('" + previewPic.src + "')";
    document.getElementById("image").innerHTML = previewPic.alt;
    console.log("Image updated on mouseover or focus.");
}

function unDo() {
    document.getElementById("image").style.backgroundImage = "url('Water.jpg')";
    document.getElementById("image").innerHTML = "Hover over an image below to display here.";
    console.log("Image reset on mouseleave or blur.");
}

function addTabFocus() {
    let images = document.querySelectorAll(".preview");
    for (let i = 0; i < images.length; i++) {
        images[i].setAttribute("tabindex", "0");

        images[i].addEventListener("mouseover", function () {
            upDate(this);
        });
        images[i].addEventListener("mouseleave", function () {
            unDo();
        });
        images[i].addEventListener("focus", function () {
            upDate(this);
        });
        images[i].addEventListener("blur", function () {
            unDo();
        });
    }
    console.log("Tab focus and events set.");
}

window.onload = function () {
    addTabFocus();
    console.log("Page fully loaded – onload triggered.");
};
