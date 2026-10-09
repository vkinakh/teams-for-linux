window.capturePicker.onSources(sources => {
  for (const source of sources) {
    const button = document.createElement('button');
    const image = document.createElement('img');
    image.src = source.thumbnail;
    const label = document.createElement('span');
    label.textContent = source.name;
    button.append(image, label);
    button.onclick = () => window.capturePicker.select(source.id);
    document.getElementById('sources').append(button);
  }
});
document.getElementById('cancel').onclick = () => window.capturePicker.select(null);
