import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private var webView: WKWebView!
    private var refreshControl: UIRefreshControl!
    private var progressView: UIProgressView!
    private var splashOverlayView: UIView!
    private var retryTimer: Timer?

    // URL de producción oficial de MoveClub en la nube
    private let appURL = URL(string: "https://moveclube-app.onrender.com")!

    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 11/255, green: 15/255, blue: 25/255, alpha: 1.0) // Slate-950

        setupWebView()
        setupProgressView()
        setupRefreshControl()
        setupNativeSplashOverlay()
        loadApp()
    }

    private func setupWebView() {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.backgroundColor = UIColor(red: 11/255, green: 15/255, blue: 25/255, alpha: 1.0)
        webView.isOpaque = false
        webView.scrollView.alwaysBounceHorizontal = false
        webView.scrollView.showsHorizontalScrollIndicator = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        view.addSubview(webView)

        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])

        webView.addObserver(self, forKeyPath: #keyPath(WKWebView.estimatedProgress), options: .new, context: nil)
    }

    private func setupNativeSplashOverlay() {
        splashOverlayView = UIView()
        splashOverlayView.translatesAutoresizingMaskIntoConstraints = false
        splashOverlayView.backgroundColor = UIColor(red: 11/255, green: 15/255, blue: 25/255, alpha: 1.0)

        // MoveClub Logo / App Icon
        let iconImageView = UIImageView()
        iconImageView.translatesAutoresizingMaskIntoConstraints = false
        iconImageView.image = UIImage(named: "AppIcon") ?? UIImage(systemName: "bolt.fill")
        iconImageView.layer.cornerRadius = 24
        iconImageView.clipsToBounds = true
        iconImageView.contentMode = .scaleAspectFit

        // Title: MOVECLUB
        let titleLabel = UILabel()
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.text = "MOVECLUB"
        titleLabel.font = UIFont.systemFont(ofSize: 26, weight: .black)
        titleLabel.textColor = .white
        titleLabel.textAlignment = .center

        // Subtitle: Entrena. Conecta. Supérate.
        let subLabel = UILabel()
        subLabel.translatesAutoresizingMaskIntoConstraints = false
        subLabel.text = "ENTRENA • CONECTA • SUPÉRATE"
        subLabel.font = UIFont.systemFont(ofSize: 12, weight: .bold)
        subLabel.textColor = UIColor(red: 56/255, green: 189/255, blue: 248/255, alpha: 1.0) // Cyan-400
        subLabel.textAlignment = .center

        // Activity Spinner
        let spinner = UIActivityIndicatorView(style: .medium)
        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.color = UIColor(red: 56/255, green: 189/255, blue: 248/255, alpha: 1.0)
        spinner.startAnimating()

        splashOverlayView.addSubview(iconImageView)
        splashOverlayView.addSubview(titleLabel)
        splashOverlayView.addSubview(subLabel)
        splashOverlayView.addSubview(spinner)
        view.addSubview(splashOverlayView)

        NSLayoutConstraint.activate([
            splashOverlayView.topAnchor.constraint(equalTo: view.topAnchor),
            splashOverlayView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            splashOverlayView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            splashOverlayView.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            iconImageView.centerXAnchor.constraint(equalTo: splashOverlayView.centerXAnchor),
            iconImageView.centerYAnchor.constraint(equalTo: splashOverlayView.centerYAnchor, constant: -50),
            iconImageView.widthAnchor.constraint(equalToConstant: 88),
            iconImageView.heightAnchor.constraint(equalToConstant: 88),

            titleLabel.topAnchor.constraint(equalTo: iconImageView.bottomAnchor, constant: 18),
            titleLabel.centerXAnchor.constraint(equalTo: splashOverlayView.centerXAnchor),

            subLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 6),
            subLabel.centerXAnchor.constraint(equalTo: splashOverlayView.centerXAnchor),

            spinner.topAnchor.constraint(equalTo: subLabel.bottomAnchor, constant: 24),
            spinner.centerXAnchor.constraint(equalTo: splashOverlayView.centerXAnchor)
        ])
    }

    private func setupProgressView() {
        progressView = UIProgressView(progressViewStyle: .default)
        progressView.translatesAutoresizingMaskIntoConstraints = false
        progressView.tintColor = UIColor(red: 56/255, green: 189/255, blue: 248/255, alpha: 1.0) // Cyan-400
        progressView.trackTintColor = .clear

        view.addSubview(progressView)

        NSLayoutConstraint.activate([
            progressView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            progressView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progressView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            progressView.heightAnchor.constraint(equalToConstant: 2.5)
        ])
    }

    private func setupRefreshControl() {
        refreshControl = UIRefreshControl()
        refreshControl.tintColor = .white
        refreshControl.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
        webView.scrollView.addSubview(refreshControl)
    }

    @objc private func handleRefresh() {
        webView.reload()
    }

    private func loadApp() {
        let request = URLRequest(url: appURL, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 30)
        webView.load(request)
    }

    override func observeValue(forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey : Any]?, context: UnsafeMutableRawPointer?) {
        if keyPath == "estimatedProgress" {
            progressView.progress = Float(webView.estimatedProgress)
            if webView.estimatedProgress >= 1.0 {
                progressView.isHidden = true
            }
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        refreshControl.endRefreshing()
        progressView.isHidden = true

        // Verify if MoveClub DOM loaded (avoid revealing Render wake-up screen)
        webView.evaluateJavaScript("document.getElementById('homeView') !== null || document.body.innerText.includes('MoveClub')") { [weak self] (result, error) in
            guard let self = self else { return }
            let isMoveClubReady = (result as? Bool) ?? false

            if isMoveClubReady {
                self.retryTimer?.invalidate()
                self.retryTimer = nil
                UIView.animate(withDuration: 0.35, animations: {
                    self.splashOverlayView.alpha = 0.0
                }) { _ in
                    self.splashOverlayView.isHidden = true
                }
            } else {
                // If Render is still waking up, keep splash overlay active and retry in 2 seconds
                if self.retryTimer == nil {
                    self.retryTimer = Timer.scheduledTimer(withTimeInterval: 2.5, repeats: true) { [weak self] _ in
                        self?.webView.reload()
                    }
                }
            }
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        refreshControl.endRefreshing()
        progressView.isHidden = true
    }

    deinit {
        webView.removeObserver(self, forKeyPath: #keyPath(WKWebView.estimatedProgress))
        retryTimer?.invalidate()
    }
}

