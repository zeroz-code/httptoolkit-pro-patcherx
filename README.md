<h1 align="center">HTTP Toolkit Pro Patcher</h1>

This is a simple tool to patch the HTTP Toolkit Pro app to enable the Pro features without a license or subscription. **But please consider supporting the developer by purchasing a license if you find the HTTP Toolkit useful.**

## Usage

1. Clone this repository using `git clone https://github.com/XielQs/httptoolkit-pro-patcher.git`
2. Run `npm install` or whatever package manager you use
3. Run `node . patch` to patch the app

That's it! The app should now have the Pro features enabled.

***Tip**: You can also run `node . restore` to restore the original app.*

**Note**: This tool only works with the latest version of the app. If the app is updated, you will need to run the patcher again.

## How it works

This tool simply creates a server *(at port 5067)* and acts as like a MITM proxy to intercept and download HTTP Toolkit app files ([app.httptoolkit.tech](https://app.httptoolkit.tech)) and patches the `main.js` file to enable the Pro features. For more information, see the [source code](patch.js).

***Tip**: You can also run `set PORT=XXXX` to change the port number.*

**Note**: This tool does not modify the original app files. It only intercepts and modifies the files in memory.

## Requirements

- [Node.js](https://nodejs.org) (v14 or higher)

## Compatibility

This tool is compatible with the windows operating system for now. It may work on other operating systems, but it has not been tested.

## Screenshot

![Screenshot](https://i.imgur.com/keYK7zR.png)

## License

This project is licensed under the [MIT License](LICENSE).

## Disclaimer

This project is for educational purposes only. I do not condone piracy or any illegal activities. Use at your own risk.

## Credits

- [HTTP Toolkit](https://httptoolkit.tech) for the awesome app
- [Titoot](https://github.com/Titoot) for the creating the [original patcher](https://github.com/Titoot/httptoolkit-interceptor)
- [XielQ](https://github.com/XielQs) for the creator of this patcher
